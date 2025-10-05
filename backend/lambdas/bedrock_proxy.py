import json
import os
import boto3
import uuid
import time
from botocore.client import Config

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime')
polly = boto3.client('polly')
s3 = boto3.client('s3', config=Config(s3={'addressing_style': 'path'}))

# Get table and bucket names from environment variables
CHUNKS_TABLE_NAME = os.environ.get('DYNAMODB_CHUNKS_TABLE')
HISTORY_TABLE_NAME = os.environ.get('DYNAMODB_HISTORY_TABLE')
AUDIOS_BUCKET = os.environ.get('AUDIOS_BUCKET')
MODEL_ID = 'openai.gpt-oss-120b-1:0'

def lambda_handler(event, context):
    try:
        print(f"## RECEIVED EVENT: {json.dumps(event)}")

        # Get user ID from the JWT authorizer's claims context
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']

        body = json.loads(event.get('body', '{}'))
        user_query = body.get('query')
        document_id = body.get('document_id')
        
        print(f"## PARSED PARAMETERS: document_id='{document_id}', user_query='{user_query}', user_id='{user_id}'")

        if not all([user_query, document_id, CHUNKS_TABLE_NAME, HISTORY_TABLE_NAME, AUDIOS_BUCKET]):
            raise ValueError("Missing required parameters or environment variables.")

        # 1. Retrieve Chat History from DynamoDB
        history_table = dynamodb.Table(HISTORY_TABLE_NAME) # type: ignore
        history_response = history_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id), # type: ignore
            # Filter for the current document
            FilterExpression=boto3.dynamodb.conditions.Attr('document_id').eq(document_id), # type: ignore
            ScanIndexForward=False, # Get the most recent messages first
            Limit=10 # Limit to the last 5 exchanges (10 items)
        )
        
        # Format the history for the prompt
        chat_history_items = sorted(history_response.get('Items', []), key=lambda item: item['timestamp'])
        chat_history_str = "\n".join([f"User: {item['user_query']}\nAI: {item['ai_response']}" for item in chat_history_items])
        print(f"## RETRIEVED CHAT HISTORY: {chat_history_str}")


        # Retrieve document chunks from DynamoDB
        chunks_table = dynamodb.Table(CHUNKS_TABLE_NAME) # type: ignore
        response = chunks_table.query(KeyConditionExpression=boto3.dynamodb.conditions.Key('document_id').eq(document_id)) # type: ignore
        chunks = [item['text_chunk'] for item in response.get('Items', [])]
        context_text = "\n".join(chunks)

        print(f"## DYNAMODB CONTEXT: Retrieved {len(chunks)} chunks for document '{document_id}'.")

        # 2. Construct the prompt with the retrieved chat history
        prompt = f"""
        Human: Use the following context and chat history to answer the user's question. If you don't know the answer, just say "Not Found".

        <context>
        {context_text}
        </context>

        <chat_history>
        {chat_history_str}
        </chat_history>

        Question: {user_query}
        
        Assistant:"""

        # Invoke the Bedrock model (OpenAI gpt-oss format)
        bedrock_request = {
            "body": json.dumps({
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.1,
                "top_p": 0.9,
            }),
            "modelId": MODEL_ID,
            "contentType": "application/json",
            "accept": "application/json"
        }
        
        bedrock_response = bedrock_runtime.invoke_model(**bedrock_request)
        response_body = json.loads(bedrock_response.get('body').read())
        
        # Extract the response text from the OpenAI output structure
        ai_full_response_text = response_body['choices'][0]['message']['content'].strip()
        try:
            ai_response_text = ai_full_response_text.split("</reasoning>")[1]
        except Exception as e:
            ai_response_text = ai_full_response_text
            print(f"[WARN] the ai responded with - \n{ai_full_response_text} and i responded with \n{ai_response_text}")

        print(f"## BEDROCK RESPONSE: '{ai_response_text}'")
        
        # 3. Save the new exchange to the chat history table
        history_table.put_item(Item={
            'user_id': user_id,
            'timestamp': int(time.time()),
            'document_id': document_id,
            'user_query': user_query,
            'ai_response': ai_response_text
        })

        # Synthesize audio response with Polly
        polly_response = polly.synthesize_speech(
            Text=ai_response_text, OutputFormat='mp3', VoiceId='Aditi'
        )

        audio_key = f"audio/{uuid.uuid4()}.mp3"
        s3.put_object(
            Bucket=AUDIOS_BUCKET, Key=audio_key,
            Body=polly_response['AudioStream'].read(), ContentType='audio/mpeg'
        )
        
        print(f"## S3 SAVE: Audio saved to bucket '{AUDIOS_BUCKET}' with key '{audio_key}'")

        audio_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': AUDIOS_BUCKET, 'Key': audio_key},
            ExpiresIn=3600
        )
        
        print(f"## PRESIGNED URL: {audio_url}")

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'response_text': ai_response_text, 'audio_url': audio_url})
        }

    except Exception as e:
        print(f"## LAMBDA ERROR: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }