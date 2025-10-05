# Sprint 6 — Scalable ASR & Voice Output

**Goal:** To replace the external transcription dependency with a scalable, self-hosted model on **Amazon SageMaker**. This sprint also completes the full voice I/O loop by adding Text-to-Speech (TTS) with **Amazon Polly**, enabling the AI to respond with spoken audio.

**Date Completed:** October 5, 2025

---

## Summary of Work Completed

This sprint successfully productionized the voice pipeline by migrating to a scalable backend and enabling spoken responses from the AI assistant.

1.  **Whisper Model Deployment to Amazon SageMaker:**
    * To resolve the scalability and rate-limiting concerns of using a public API, the `openai/whisper-large-v3` model was deployed to a dedicated **Amazon SageMaker real-time endpoint**.
    * A custom deployment package was created with a specific `inference.py` script and `requirements.txt` to handle model loading and dependencies correctly within the SageMaker environment.
    * The deployment was configured with a GPU instance (`ml.g4dn.xlarge`) after requesting and receiving a service quota increase.

2.  **Transcription Lambda Refactoring:**
    * The `transcribe_proxy` Lambda function was updated to use the AWS SDK (`boto3`) to invoke the new private SageMaker endpoint, making the transcription process secure and entirely hosted within AWS.

3.  **Amazon Polly Integration (Text-to-Speech):**
    * The `bedrock_proxy` Lambda was extended to implement the Text-to-Speech functionality as originally planned.
    * After receiving a text answer from the Amazon Titan model, the function now calls the **Amazon Polly** service to synthesize the text into an MP3 audio stream.

4.  **Backend Infrastructure and IAM Updates:**
    * A new S3 bucket was created specifically for audio files to keep assets organized.
    * The `pdf-talker-lambda-exec` IAM role was updated with new permissions for `sagemaker:InvokeEndpoint` and `polly:SynthesizeSpeech`, allowing the Lambdas to access these services.
    * The `bedrock_proxy` Lambda's timeout was increased to **30 seconds** to prevent it from terminating before receiving a response from the Bedrock model.

5.  **Troubleshooting and Refinements:**
    * Resolved a `500 Internal Server Error` by adding a **CORS policy** to the new audios S3 bucket, which allows the browser to securely fetch and play the audio files.
    * Corrected the S3 client configuration in the `bedrock_proxy` and `preasign_upload` lambdas to generate **path-style presigned URLs**, improving compatibility with browser security policies and resolving the final playback errors.

---

## Sprint 6 Acceptance Criteria (Checklist)

* [x] The Whisper ASR model is successfully deployed to a dedicated Amazon SageMaker endpoint.
* [x] The `pdf-talker-lambda-exec` IAM role is updated with permissions for SageMaker invocation and Amazon Polly.
* [x] The `transcribe_proxy` Lambda is updated to use the SageMaker endpoint.
* [x] The `bedrock_proxy` Lambda successfully sends its text response to Amazon Polly, synthesizes speech, and saves it to a dedicated S3 audio bucket.
* [x] The frontend receives and automatically plays the synthesized audio response from the presigned URL.
* [x] The user can ask a question with their voice and receive a spoken answer from the AI.
* [x] The entire voice-to-text and text-to-voice pipeline is working end-to-end and is hosted within AWS.