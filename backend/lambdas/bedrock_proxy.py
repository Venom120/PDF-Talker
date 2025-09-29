import json
import boto3
import os
from boto3.dynamodb.conditions import Key

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
bedrock_runtime = boto3.client(service_name='bedrock-runtime')

# Get table name from environment variables
CHUNKS_TABLE_NAME = os.environ.get('DYNAMODB_CHUNKS_TABLE')
chunks_table = dynamodb.Table(CHUNKS_TABLE_NAME)

# Define the Bedrock model ID
MODEL_ID = "amazon.titan-text-express-v1"

def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        query = body.get('query')
        document_id = body.get('document_id')

        if not query or not document_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"message": "Missing 'query' or 'document_id' in request body."})
            }

        response = chunks_table.query(
            KeyConditionExpression=Key('document_id').eq(document_id)
        )
        chunks = [item['text_chunk'] for item in response.get('Items', [])]
        
        if not chunks:
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"message": "No content found for the specified document."})
            }

        context_string = "\n".join(chunks)

        # The prompt is simplified for the Titan model
        prompt = f"""
        Based on the following document context, please answer the user's question.

        Context:
        {context_string}

        Question: {query}

        Provide a concise answer based only on the information in the document context. If the answer is not in the context, say "I could not find an answer to that in the document."
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
        answer = response_body['results'][0]['outputText']

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization"
            },
            "body": json.dumps({"answer": answer.strip()})
        }

    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "An internal error occurred."})
        }