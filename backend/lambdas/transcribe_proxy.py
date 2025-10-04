import json
import os
import base64
import boto3
from huggingface_hub import InferenceClient # type: ignore

# --- Initialization (No changes here) ---
HF_TOKEN = os.environ.get('HF_TOKEN')
print("Lambda initializing...")

hf_client = None
if HF_TOKEN:
    print("HF_TOKEN found, initializing InferenceClient.")
    hf_client = InferenceClient(token=HF_TOKEN)
else:
    print("ERROR: HF_TOKEN environment variable not set!")
# --- End of Initialization ---

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

        if not hf_client:
            raise Exception("Hugging Face client is not initialized. Check HF_TOKEN.")

        print("Step 3: Sending audio data to Hugging Face Whisper API...")
        result = hf_client.automatic_speech_recognition(
            audio_bytes,
            model="openai/whisper-large-v3"
        )
        print(f"Step 4: Received response from Hugging Face: {result}")

        transcript = result.get("text", "").strip()
        print(f"Step 5: Returning transcript in HTTP response: '{transcript}'")

        # Return a standard HTTP response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' # Important for CORS
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
                'Access-Control-Allow-Origin': '*' # Important for CORS
            },
            'body': json.dumps({'error': str(e)})
        }