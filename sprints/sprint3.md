# Sprint 3 — PDF Ingestion to DynamoDB

**Goal:** To automatically extract text from any PDF uploaded to the S3 bucket, break it into meaningful chunks, and **store those chunks in a DynamoDB table**. This prepares the content for retrieval by our AI agent in the next sprint.

**Date Completed:** September 29, 2025

---

## Summary of Work Completed

This sprint successfully built the backend data pipeline for our application. When a user uploads a PDF, the system now automatically processes it and makes its content ready for the AI.

1.  **DynamoDB Table Creation:**
    * A new DynamoDB table named `pdf_talker_chunks` was created to store the text segments extracted from the PDFs.
    * The table uses a composite primary key (`document_id` as the partition key and `chunk_id` as the sort key) to efficiently organize the data.

2.  **IAM Policy Update:**
    * The `pdf-talker-lambda-exec` IAM role was updated.
    * I added permissions for `dynamodb:BatchWriteItem` and granted access to the new `pdf_talker_chunks` table, ensuring the Lambda function could save the processed text.

3.  **PDF Parsing Library Integration:**
    * initially attempted to use `PyMuPDF` but encountered compilation errors related to the Lambda environment (`GLIBC` incompatibility).
    * To resolve this, I pivoted to **`pypdf`**, a pure-Python library that does not require compilation.
    * A new Lambda Layer (`pypdf-layer`) was created and successfully deployed, containing the `pypdf` library.

4.  **Lambda Function Logic:**
    * The `s3_ingest_trigger` Lambda function was completely rewritten.
    * The new code now successfully downloads the PDF from the S3 trigger event, uses the `pypdf` library to extract all text, splits the text into manageable chunks, and writes each chunk as an item to the `pdf_talker_chunks` DynamoDB table.

---

## Sprint 3 (Revised) Acceptance Criteria (Checklist)

* [x] A new DynamoDB table named `pdf_talker_chunks` is created.
* [x] The `pdf-talker-lambda-exec` IAM role is updated with a policy to allow read/write actions on the new `pdf_talker_chunks` table.
* [x] The `s3_ingest_trigger` Lambda function is updated with new Python code for ingestion.
* [x] The Lambda function has a new layer or dependency package (`pypdf`) to handle PDF text extraction.
* [x] When a PDF is uploaded to the `...-pdfs` S3 bucket, the Lambda is triggered successfully.
* [x] The Lambda downloads the PDF, extracts its text, and splits it into chunks.
* [x] The text chunks are successfully saved as items in the `pdf_talker_chunks` DynamoDB table.
* [x] CloudWatch logs for the Lambda function show no errors during the ingestion process.
* [x] (Manual Verification) We can view the items in the `pdf_talker_chunks` table in the AWS Console and see the extracted text from the uploaded PDF.