import json
import boto3
import os
import base64
import asyncio
import websockets
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import get_credentials
from botocore.session import Session

# --- Initialization ---
API_GW_ENDPOINT = os.environ.get('API_GW_ENDPOINT')
if not API_GW_ENDPOINT:
    raise ValueError("API_GW_ENDPOINT environment variable not set!")

apigateway_management_client = boto3.client('apigatewaymanagementapi', endpoint_url=API_GW_ENDPOINT)
REGION = os.environ.get('AWS_REGION', 'ap-south-1')
# --- End of Initialization ---

def get_presigned_url():
    """Generates a presigned URL for the Transcribe streaming service."""
    request = AWSRequest(
        method="GET",
        url=f"https://transcribestreaming.{REGION}.amazonaws.com:8443/stream-transcription-websocket",
        headers={
            "host": f"transcribestreaming.{REGION}.amazonaws.com:8443"
        }
    )
    session = Session()
    credentials = get_credentials(session)
    SigV4Auth(credentials, "transcribe", REGION).add_auth(request)
    return request.url

async def send_receive(connection_id, audio_chunk):
    """Connects to Transcribe, sends audio, receives transcript, and sends it to the client."""
    presigned_url = get_presigned_url()
    if presigned_url:
        presigned_url = presigned_url.replace("https://", "wss://")
    else:
        print("Error in getting presigned url")
        return
    async with websockets.connect(presigned_url) as ws:
        # 1. Send the initial configuration message to Transcribe
        await ws.send(json.dumps({
            "headers": {
                ":message-type": "event",
                ":event-type": "Configuration",
            },
            "body": {
                "LanguageCode": "en-US",
                "MediaEncoding": "pcm",
                "MediaSampleRateHertz": 16000,
            }
        }))

        # 2. Send the audio chunk
        # CORRECTED: Use list() to convert bytes to a JSON-serializable list of integers
        await ws.send(json.dumps({
            "headers": {
                ":message-type": "event",
                ":event-type": "AudioEvent"
            },
            "body": list(audio_chunk)
        }))
        
        # 3. Signal that the audio stream has ended
        await ws.send(json.dumps({
            "headers": {
                ":message-type": "event",
                ":event-type": "EndOfStream"
            },
            "body": {}
        }))

        # 4. Receive and process the transcription results
        final_transcript = ""
        while True:
            try:
                message = await ws.recv()
                data = json.loads(message)
                if 'Transcript' in data:
                    results = data['Transcript']['Results']
                    if results and not results[0]['IsPartial']:
                        final_transcript += results[0]['Alternatives'][0]['Transcript'] + " "
                elif 'Exception' in data:
                    print(f"Transcription error from AWS: {data['Exception']['Message']}")
                    break
            except websockets.exceptions.ConnectionClosed as e:
                print(f"WebSocket connection closed: {e}")
                break
        
        # 5. Send the final transcript back to the browser
        if final_transcript:
            print(f"Final transcript: {final_transcript.strip()}")
            apigateway_management_client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps({'transcript': final_transcript.strip()})
            )

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    route_key = event['requestContext']['routeKey']

    if route_key == '$connect' or route_key == '$disconnect':
        return {'statusCode': 200}

    elif route_key == '$default':
        try:
            body = json.loads(event['body'])
            audio_b64 = body.get('audio_data')
            if audio_b64:
                audio_chunk = base64.b64decode(audio_b64)
                asyncio.run(send_receive(connection_id, audio_chunk))
        except Exception as e:
            print(f"Error in default route: {e}")
            return {'statusCode': 500}
        
        return {'statusCode': 200}

    return {'statusCode': 400}