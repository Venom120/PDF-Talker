import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')
HISTORY_TABLE_NAME = os.environ.get('DYNAMODB_HISTORY_TABLE')

def lambda_handler(event, context):
    try:
        http_method = event['requestContext']['http']['method']
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        document_id = event['queryStringParameters']['document_id']

        if not all([document_id, HISTORY_TABLE_NAME]):
            raise ValueError("Missing required parameters: document_id or env vars.")
            
        table = dynamodb.Table(HISTORY_TABLE_NAME) # type: ignore

        # --- Handle GET Request: Fetch History ---
        if http_method == 'GET':
            print(f"## INFO: Handling GET request for user '{user_id}' and document '{document_id}'")
            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id), # type: ignore
                FilterExpression=boto3.dynamodb.conditions.Attr('document_id').eq(document_id), # type: ignore
                ScanIndexForward=True  # Oldest to newest
            )
            items = response.get('Items', [])
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(items)
            }

        # --- Handle DELETE Request: Clear History ---
        elif http_method == 'DELETE':
            print(f"## INFO: Handling DELETE request for user '{user_id}' and document '{document_id}'")
            # Step 1: Find all items to delete
            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id), # type: ignore
                FilterExpression=boto3.dynamodb.conditions.Attr('document_id').eq(document_id) # type: ignore
            )
            items_to_delete = response.get('Items', [])

            # Step 2: Delete items in a batch
            if items_to_delete:
                with table.batch_writer() as batch:
                    for item in items_to_delete:
                        batch.delete_item(
                            Key={
                                'user_id': item['user_id'],
                                'timestamp': item['timestamp']
                            }
                        )
                print(f"## SUCCESS: Deleted {len(items_to_delete)} items.")
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'message': 'Chat history cleared successfully.'})
            }
        
        # --- Handle other methods ---
        else:
            raise ValueError(f"Unsupported HTTP method: {http_method}")

    except Exception as e:
        print(f"## LAMBDA ERROR: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }
