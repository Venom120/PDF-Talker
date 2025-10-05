import json
import logging
import boto3
import os
import urllib.parse
from pypdf import PdfReader # type: ignore

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Get table name from environment variables
CHUNKS_TABLE_NAME = os.environ.get('DYNAMODB_CHUNKS_TABLE')
chunks_table = dynamodb.Table(CHUNKS_TABLE_NAME) # type: ignore

def chunk_text(text, chunk_size=500, chunk_overlap=50):
    """Splits text into chunks of a specified size with overlap."""
    if not text:
        return []
    
    words = text.split()
    if not words:
        return []

    chunks = []
    current_pos = 0
    while current_pos < len(words):
        start = current_pos
        end = current_pos + chunk_size
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        current_pos += chunk_size - chunk_overlap
    return chunks

def lambda_handler(event, context):
    logger.info("Received S3 event: %s", json.dumps(event))

    for record in event.get('Records', []):
        bucket_name = record['s3']['bucket']['name']
        object_key = urllib.parse.unquote_plus(record['s3']['object']['key'])
        
        logger.info(f"Processing new object: s3://{bucket_name}/{object_key}")
        tmp_file_path = f"/tmp/{os.path.basename(object_key)}"

        try:
            # Download the PDF from S3
            s3.download_file(bucket_name, object_key, tmp_file_path)
            logger.info(f"Successfully downloaded PDF to {tmp_file_path}")

            # Extract text using pypdf
            reader = PdfReader(tmp_file_path)
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text() + "\n"

            if not full_text.strip():
                logger.warning(f"PDF '{object_key}' contains no extractable text.")
                continue

            # Chunk the extracted text
            text_chunks = chunk_text(full_text)
            logger.info(f"Split text into {len(text_chunks)} chunks.")

            # Store chunks in DynamoDB
            with chunks_table.batch_writer() as batch:
                for i, chunk in enumerate(text_chunks):
                    batch.put_item(
                        Item={
                            'document_id': object_key,
                            'chunk_id': i,
                            'text_chunk': chunk
                        }
                    )
            
            logger.info(f"Successfully indexed all chunks for '{object_key}' into DynamoDB.")

        except Exception as e:
            logger.error(f"Error processing {object_key}: {e}", exc_info=True)
            return {"statusCode": 500, "body": json.dumps({"message": "Error processing file."})}
        finally:
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

    return {"statusCode": 200, "body": json.dumps({"message": "Ingestion complete."})}