# paste this code in lambda_function.py in the aws console lambda service
import json, logging, boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3 = boto3.client('s3')

def lambda_handler(event, context):
    logger.info("Received S3 event: %s", json.dumps(event))
    for rec in event.get('Records', []):
        bucket = rec['s3']['bucket']['name']
        key = rec['s3']['object']['key']
        logger.info(f"New object: s3://{bucket}/{key}")
        # TODO: download object, run text extraction (PyMuPDF/pdfminer), chunk, push to Kendra/OpenSearch
    return {"statusCode":200}
