import json

def lambda_handler(event, context):
    # Log the entire event for debugging purposes
    print(f"Received event: {json.dumps(event)}")

    if 'requestContext' not in event:
        # This can happen if tested with a default event
        print("Error: Event is missing 'requestContext'. Make sure you are testing with an API Gateway WebSocket event template.")
        return {'statusCode': 400, 'body': 'Invalid event structure'}

    connection_id = event['requestContext']['connectionId']
    route_key = event['requestContext']['routeKey']

    if route_key == '$connect':
        print(f"Connection established: {connection_id}")
        return {'statusCode': 200, 'body': 'Connected.'}

    elif route_key == '$disconnect':
        print(f"Connection disconnected: {connection_id}")
        return {'statusCode': 200, 'body': 'Disconnected.'}

    elif route_key == '$default':
        print(f"Received message from {connection_id}: {event.get('body', '')}")
        # In a real application, you would process the audio stream here
        # and send back transcription results.
        return {'statusCode': 200, 'body': 'Message received.'}

    return {'statusCode': 400, 'body': f'Unsupported route key: {route_key}'}