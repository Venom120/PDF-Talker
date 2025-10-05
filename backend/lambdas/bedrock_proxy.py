import json
import os
import boto3
import uuid
from botocore.client import Config

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime')
polly = boto3.client('polly')
s3 = boto3.client('s3', config=Config(s3={'addressing_style': 'path'}))

# Get table and bucket names from environment variables
TABLE_NAME = os.environ.get('DYNAMODB_CHUNKS_TABLE')
AUDIOS_BUCKET = os.environ.get('AUDIOS_BUCKET')
MODEL_ID = 'amazon.titan-text-express-v1'

def lambda_handler(event, context):
    try:
        # --- DEBUG: Log the entire incoming event from API Gateway ---
        print(f"## RECEIVED EVENT: {json.dumps(event)}")

        body = json.loads(event.get('body', '{}'))
        user_query = body.get('query')
        document_id = body.get('document_id')
        
        # --- DEBUG: Log the parsed input parameters ---
        print(f"## PARSED PARAMETERS: document_id='{document_id}', user_query='{user_query}'")

        if not all([user_query, document_id, TABLE_NAME, AUDIOS_BUCKET]):
            raise ValueError("Missing required parameters: query, document_id, or env vars.")

        table = dynamodb.Table(TABLE_NAME) # type: ignore
        response = table.query(KeyConditionExpression=boto3.dynamodb.conditions.Key('document_id').eq(document_id)) # type: ignore
        chunks = [item['text_chunk'] for item in response.get('Items', [])]
        context_text = "\n".join(chunks)

        # --- DEBUG: Log the context retrieved from DynamoDB ---
        print(f"## DYNAMODB CONTEXT: Retrieved {len(chunks)} chunks for document '{document_id}'. Total context length: {len(context_text)} chars.")

        prompt = f"""\n\nHuman: Use the following context to answer the user's question. If you don't know the answer, just say that you don't know.
        <context>{context_text}</context>
        Question: {user_query}\n\nAssistant:"""

        bedrock_request = {
            "body": json.dumps({
                "inputText": prompt,
                "textGenerationConfig": {"maxTokenCount": 512, "temperature": 0.1, "topP": 0.9}
            }),
            "modelId": MODEL_ID, "contentType": "application/json", "accept": "application/json"
        }
        bedrock_response = bedrock_runtime.invoke_model(**bedrock_request)
        response_body = json.loads(bedrock_response.get('body').read())
        ai_response_text = response_body.get('results')[0].get('outputText').strip()

        # --- DEBUG: Log the text response from Bedrock ---
        print(f"## BEDROCK RESPONSE: '{ai_response_text}'")

        polly_response = polly.synthesize_speech(
            Text=ai_response_text, OutputFormat='mp3', VoiceId='Aditi'
        )

        audio_key = f"audio/{uuid.uuid4()}.mp3"
        s3.put_object(
            Bucket=AUDIOS_BUCKET, Key=audio_key,
            Body=polly_response['AudioStream'].read(), ContentType='audio/mpeg'
        )
        
        # --- DEBUG: Log the S3 key for the new audio file ---
        print(f"## S3 SAVE: Successfully saved audio to bucket '{AUDIOS_BUCKET}' with key '{audio_key}'")

        audio_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': AUDIOS_BUCKET, 'Key': audio_key},
            ExpiresIn=3600
        )
        
        # --- DEBUG: Log the final presigned URL ---
        print(f"## PRESIGNED URL: Generated URL is: {audio_url}")

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'response_text': ai_response_text, 'audio_url': audio_url})
        }

    except Exception as e:
        # --- DEBUG: Log any exception that occurs ---
        print(f"## LAMBDA ERROR: An exception occurred: {e}")
        # Use exc_info=True in a real logger for a full stack trace, but this is fine for basic debugging.
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }