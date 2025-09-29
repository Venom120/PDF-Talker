import os
import json
import boto3

s3 = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))
PDF_BUCKET = os.environ.get('PDF_BUCKET')

def lambda_handler(event, context):
    allowed_origin = "http://localhost:5173"
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }

    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {"statusCode": 204, "headers": headers}
        
    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('key')
        if not file_name:
            file_name = f"uploads/{context.aws_request_id}.pdf"

        # 1. Generate the presigned URL for UPLOADING (PUT)
        upload_url = s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': PDF_BUCKET, 'Key': file_name, 'ContentType': 'application/pdf'},
            ExpiresIn=3600  # 1 hour
        )
        
        # 2. Generate a separate presigned URL for VIEWING (GET)
        get_object_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': PDF_BUCKET, 'Key': file_name},
            ExpiresIn=3600 # 1 hour
        )
        
        # 3. Return BOTH URLs to the frontend
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "uploadURL": upload_url, 
                "getObjectURL": get_object_url,
                "s3_key": file_name # Ensure this line is present
            })
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"message": "An internal error occurred."})
        }

