# Sprint 4 — Basic Agent & LLM Integration (Text-Only)

**Goal:** To create a functional, text-based question-and-answering flow. The user will be able to type a question about the uploaded PDF, and the backend will use Amazon Bedrock to generate an answer based on the stored text chunks.

**Date Completed:** September 30, 2025

---

## Summary of Work Completed

This sprint successfully brought the AI agent to life by creating a complete, end-to-end question-answering pipeline.

1.  **Bedrock Proxy Lambda:**
    * A new Lambda function, `bedrock_proxy`, was created to serve as the central orchestrator for the AI agent.
    * The function is responsible for receiving user queries, retrieving data, and calling the AI model.

2.  **DynamoDB Data Retrieval:**
    * The Lambda was configured to query the `pdf_talker_chunks` DynamoDB table, fetching all the relevant text chunks for a given document to use as context for the AI.

3.  **Amazon Bedrock Integration:**
    * We successfully integrated the AWS Bedrock service. The Lambda function constructs a RAG (Retrieval-Augmented Generation) prompt containing the user's question and the retrieved PDF context.
    * The prompt is sent to the **Amazon Titan Text Express** model, which generates a contextually-aware answer.
    * Initial `AccessDeniedException` and `ValidationException` errors were resolved by enabling model access in the Bedrock console and correcting the request body format to match the Titan model's schema.

4.  **API Gateway Endpoint:**
    * A new `POST /query` route was created in API Gateway and linked to the `bedrock_proxy` Lambda function, allowing the frontend to securely communicate with the AI backend.

5.  **Frontend UI Update:**
    * The main `App.jsx` component was significantly updated to manage the state for the Q&A functionality.
    * The text input field and "Ask" button are now fully functional, sending the user's query and the document's S3 key to the new `/query` endpoint.
    * The response from the AI is now displayed in the "AI Assistant" panel, providing a complete and interactive user experience.

---

## Sprint 4 Acceptance Criteria (Checklist)

* [x] A new Lambda function, `bedrock_proxy`, is created and deployed.
* [x] The `pdf-talker-lambda-exec` IAM role is updated to allow the new function to query the `pdf_talker_chunks` table.
* [x] A new `POST /query` route is added to the API Gateway and configured to trigger the `bedrock_proxy` Lambda.
* [x] The `bedrock_proxy` function successfully retrieves all text chunks for a given document from DynamoDB.
* [x] The function correctly constructs a RAG prompt and invokes a model (Amazon Titan Text Express) in Amazon Bedrock.
* [x] The frontend `App.jsx` is updated to handle user text input and the "Ask" button.
* [x] When a user asks a question, the frontend sends a request to the `/query` endpoint.
* [x] The AI's response is successfully received and displayed in the UI.
* [x] The full text-based Q&A loop is working end-to-end without errors.