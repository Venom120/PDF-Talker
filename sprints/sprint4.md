# Sprint 4 — Basic Agent & LLM Integration (Text-Only)

**Goal:** To create a functional, text-based question-and-answering flow. The user will be able to type a question about the uploaded PDF, and the backend will use Amazon Bedrock to generate an answer based on the stored text chunks.

**Date to be Completed:** October 10, 2025

---

## Summary of Plan

This sprint connects our frontend UI to the AI backend. We will create a new "proxy" Lambda function that acts as the main orchestrator for our agent.

1.  **Create a New `bedrock_proxy` Lambda:** This function will be the heart of our application. It will receive the user's question and the document ID from the frontend.
2.  **Retrieve Data from DynamoDB:** The Lambda will query our `pdf_talker_chunks` table to fetch all the text chunks associated with the current PDF.
3.  **Construct a RAG Prompt:** It will format the retrieved text chunks and the user's question into a clear prompt for the language model. This process is called Retrieval-Augmented Generation (RAG).
4.  **Invoke Amazon Bedrock:** The function will send the prompt to a powerful language model (like Anthropic's Claude) via the Amazon Bedrock service to get a high-quality, context-aware answer.
5.  **Create a New API Gateway Route:** We will add a new `POST /query` route to our API Gateway to expose the `bedrock_proxy` function to the internet.
6.  **Update the Frontend:** We will enable the "Ask" button and text input field in the UI. When a user asks a question, the frontend will call the new `/query` endpoint and display the returned answer.

---

## Sprint 4 Acceptance Criteria (Checklist)

* [ ] A new Lambda function, `bedrock_proxy`, is created and deployed.
* [ ] The `pdf-talker-lambda-exec` IAM role is updated to allow the new function to query the `pdf_talker_chunks` table.
* [ ] A new `POST /query` route is added to the API Gateway and configured to trigger the `bedrock_proxy` Lambda.
* [ ] The `bedrock_proxy` function successfully retrieves all text chunks for a given document from DynamoDB.
* [ ] The function correctly constructs a RAG prompt and invokes a model (e.g., Claude 3 Sonnet) in Amazon Bedrock.
* [ ] The frontend `App.jsx` is updated to handle user text input and the "Ask" button.
* [ ] When a user asks a question, the frontend sends a request to the `/query` endpoint.
* [ ] The AI's response is successfully received and displayed in the UI.
* [ ] The full text-based Q&A loop is working end-to-end without errors.
