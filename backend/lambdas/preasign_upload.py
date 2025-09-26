# paste this code in lambda_function.py in the aws console lambda service
import os, json, boto3

s3 = boto3.client('s3', region_name='ap-south-1')
PDF_BUCKET = os.environ.get('PDF_BUCKET')

def lambda_handler(event, context):
    # expects JSON body: {"key":"uploads/filename.pdf"} or will generate one
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except:
            body = {}
    key = body.get('key') or f"uploads/{context.aws_request_id}.pdf"
    url = s3.generate_presigned_url('put_object', Params={'Bucket': PDF_BUCKET, 'Key': key}, ExpiresIn=3600)
    return {
        "statusCode": 200,
        "headers":{"Content-Type":"application/json"},
        "body": json.dumps({"url": url, "key": key})
    }
