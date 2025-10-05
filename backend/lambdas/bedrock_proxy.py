import json
import boto3
import os
import uuid

# Initialize AWS clients
bedrock_runtime = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
polly = boto3.client('polly')
s3 = boto3.client('s3')

# Get environment variables
CHUNKS_TABLE_NAME = os.environ.get('CHUNKS_TABLE_NAME', 'pdf_talker_chunks')
ASSETS_BUCKET_NAME = os.environ.get('ASSETS_BUCKET_NAME') # Ensure this is set in your Lambda's environment variables
chunks_table = dynamodb.Table(CHUNKS_TABLE_NAME) # type: ignore
MODEL_ID = "amazon.titan-text-express-v1"

def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        user_query = body.get('query')
        document_id = body.get('document_id') # s3_key from the frontend

        if not user_query or not document_id:
            return {"statusCode": 400, "body": json.dumps({"error": "Missing 'query' or 'document_id'"})}

        # 1. Retrieve all chunks for the document from DynamoDB
        response = chunks_table.query(KeyConditionExpression=boto3.dynamodb.conditions.Key('document_id').eq(document_id)) # type: ignore
        context_chunks = [item['text_chunk'] for item in response.get('Items', [])]
        full_context = " ".join(context_chunks)

        # 2. Construct the RAG prompt
        prompt = f"""
        Based on the following document context, please answer the user's question.

        Context:
        {full_context}

        Question: {user_query}

        Provide a answer based only on the information in the document context. And you can deduce few more things from the the document also by your own knowledge. But if the answer is not in the context, say "I could not find an answer to that in the document."
        """

        # 3. Invoke the Bedrock model with the CORRECT format for Titan
        bedrock_request_body = {
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": 1024,
                "temperature": 0.7,
                "topP": 1,
            }
        }
        
        bedrock_response = bedrock_runtime.invoke_model(
            body=json.dumps(bedrock_request_body),
            modelId=MODEL_ID,
            contentType='application/json',
            accept='application/json'
        )
        
        # Parse the CORRECT response format for Titan
        response_body = json.loads(bedrock_response['body'].read())
        ai_response_text = (response_body['results'][0].get('outputText', 'Sorry, I could not generate a response.')).strip()

        # 4. Synthesize speech with Amazon Polly
        polly_response = polly.synthesize_speech(
            Text=ai_response_text,
            OutputFormat='mp3',
            VoiceId='Aditi' # You can choose another voice, e.g., 'Matthew', 'Aditi'
        )

        # 5. Save the audio to the S3 assets bucket
        audio_key = f"audio/{uuid.uuid4()}.mp3"
        s3.put_object(
            Bucket=ASSETS_BUCKET_NAME,
            Key=audio_key,
            Body=polly_response['AudioStream'].read(),
            ContentType='audio/mpeg'
        )

        # 6. Generate a presigned URL for the audio file
        audio_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': ASSETS_BUCKET_NAME, 'Key': audio_key},
            ExpiresIn=3600  # URL expires in 1 hour
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"response_text": ai_response_text, "audio_url": audio_url})
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}