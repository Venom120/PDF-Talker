# Sprint 7 Plan: Chat History and Multi-User Support

This document outlines the plan for Sprint 7, which focuses on enhancing the PDF-Talker application with chat history and multi-user capabilities.

-----

## Part 1: Frontend - Chat History UI

The first part of this sprint will focus on updating the frontend to support a chat-like interface for displaying conversation history.

### Tasks

  * **Chat History Component**:
      * Create a new React component to display the conversation history.
      * Each message in the history should clearly distinguish between the user's query and the AI's response.
      * The component should automatically scroll to the latest message.
  * **State Management**:
      * Implement state management to store the conversation history (e.g., using `useState` or a more robust solution like Redux if the application is expected to grow).
      * The state should be updated after each new query and response.
  * **API Request Modification**:
      * Modify the `handleAsk` function in `App.jsx` to send the entire chat history along with the current query to the backend. The payload should be structured to differentiate between the current question and the previous conversation context.

-----

## Part 2: Backend - Session Management and Multi-User Support

The second part of this sprint will involve updating the backend to handle multiple users and manage conversation history.

### Tasks

  * **Authentication and User Identification**:

      * The frontend already includes an authentication context (`useAuth`) that can be used to obtain a unique token for each user (e.g., `auth.user?.id_token`). This token should be sent with each API request to the `/query` endpoint.

  * **Bedrock Proxy Update**:

      * Modify the `bedrock_proxy.py` Lambda function to extract the user's token from the request headers.
      * Use this token to segregate chat histories for different users. A DynamoDB table can be used to store conversation history, with the user's token as a partition key.

  * **Prompt Engineering**:

      * Update the prompt sent to the Bedrock model to include the conversation history. The prompt should be structured to provide context for the current question, enabling follow-up questions. For example:

    <!-- end list -->

    ```python
    prompt = f"""\n\nHuman: Use the following context and chat history to answer the user's question. If you don't know the answer, just say "Not Found".

    <context>{context_text}</context>

    <chat_history>
    {chat_history}
    </chat_history>

    Question: {user_query}\n\nAssistant:"""
    ```

  * **DynamoDB for Chat History**:

      * Create a new DynamoDB table to store chat history.
      * The table should include attributes such as `user_id`, `timestamp`, `user_query`, and `ai_response`.
      * Before querying the Bedrock model, retrieve the user's chat history from DynamoDB and include it in the prompt.
      * After receiving the response from the model, save the new question and answer to the chat history table.
