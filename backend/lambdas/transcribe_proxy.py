import json
import os
import base64
import boto3

# Initialize the SageMaker runtime client
sagemaker_runtime = boto3.client('sagemaker-runtime')

# Get the endpoint name from an environment variable
SAGEMAKER_ENDPOINT_NAME = os.environ.get('SAGEMAKER_ENDPOINT_NAME')

def lambda_handler(event, context):
    try:
        print("Received HTTP POST request to /transcribe")
        body = json.loads(event.get('body', '{}'))
        audio_b64 = body.get('audio_data')

        if not audio_b64:
            raise ValueError("Missing audio_data in request payload.")

        print(f"Step 1: Received Base64 audio string of length {len(audio_b64)}.")
        audio_bytes = base64.b64decode(audio_b64)
        print(f"Step 2: Decoded audio to {len(audio_bytes)} bytes.")

        if not SAGEMAKER_ENDPOINT_NAME:
            raise Exception("SageMaker endpoint name environment variable not set.")

        print(f"Step 3: Sending audio data to SageMaker endpoint: {SAGEMAKER_ENDPOINT_NAME}...")

        # Invoke the SageMaker endpoint
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=SAGEMAKER_ENDPOINT_NAME,
            ContentType='audio/x-audio', # The model expects a raw audio content type
            Body=audio_bytes
        )

        print("Step 4: Received response from SageMaker.")

        # The response body is a streaming object, so we need to read and decode it
        response_body = response['Body'].read().decode('utf-8')
        response_json = json.loads(response_body)

        # The Whisper model returns the transcript in a 'text' key
        transcript = response_json.get("text", "").strip()

        print(f"Step 5: Returning transcript in HTTP response: '{transcript}'")

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            },
            'body': json.dumps({'transcript': transcript})
        }

    except Exception as e:
        print(f"--- ERROR IN LAMBDA ---")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Details: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }