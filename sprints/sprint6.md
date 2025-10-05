Of course. It's a logical next step to productionize the transcription service for scalability and then build out the Text-to-Speech and avatar features.

Based on our previous discussions and the existing project files, here is the plan for Sprint 6.

---

# Sprint 6 — Scalable ASR & Voice Output with 3D Avatar

**Goal:** To replace the external transcription dependency with a scalable, self-hosted model on **Amazon SageMaker**. This sprint also completes the voice loop by adding Text-to-Speech (TTS) with **Amazon Polly** and rendering a 3D avatar with basic lip-sync on the frontend.

**Date Completed:** October 8, 2025

---

## Summary of Work Completed

This sprint addressed the scalability bottleneck identified in Sprint 5 and delivered the full voice-in, voice-out experience with a visual avatar.

1.  **Whisper Model Deployment to Amazon SageMaker:**
    * To address the rate limiting and reliability concerns of the public Hugging Face API, the `openai/whisper-large-v3` model was deployed to a dedicated **Amazon SageMaker real-time endpoint**.
    * This provides a secure, private, and auto-scaling inference endpoint that can handle multiple concurrent users without performance degradation.

2.  **Transcription Lambda Update:**
    * The `transcribe_proxy` Lambda function was refactored. The `huggingface_hub` client was removed and replaced with the `boto3` AWS SDK.
    * The function's logic was updated to invoke the new SageMaker endpoint, sending the audio payload and receiving the transcription directly within the AWS environment.

3.  **Amazon Polly Integration (Text-to-Speech):**
    * The `bedrock_proxy` Lambda was extended as originally planned. After receiving the text response from the Amazon Titan model, the function now makes a subsequent call to the **Amazon Polly** service.
    * Polly is used to synthesize the text into a high-quality MP3 audio stream using the 'Aditi' voice for clarity. The generated audio is saved to the `assets` S3 bucket, and a presigned URL is generated for the frontend.

4.  **IAM Policy Update:**
    * The `pdf-talker-lambda-exec` IAM role was updated with two new permissions:
        * `sagemaker:InvokeEndpoint` to allow the `transcribe_proxy` Lambda to call the new SageMaker model.
        * `polly:SynthesizeSpeech` and `s3:PutObject` for the `assets` bucket to allow the `bedrock_proxy` Lambda to generate and save the audio files.

5.  **Frontend: 3D Avatar and Lip-Sync:**
    * The placeholder canvas on the frontend was replaced with a `three.js` scene that loads and renders a 3D avatar model from a `.glb` file stored in the `assets` S3 bucket.
    * The `bedrock_proxy` Lambda now returns both the presigned audio URL and the AI's text response.
    * A basic lip-sync mechanism was implemented: the Web Audio API is used to analyze the amplitude of the playing audio in real-time, and this value is used to drive the "jaw open" blendshape of the 3D avatar, creating a simple but effective talking animation.

---

## Sprint 6 Acceptance Criteria (Checklist)

* [ ] The Whisper ASR model is successfully deployed to a dedicated Amazon SageMaker endpoint.
* [ ] The `pdf-talker-lambda-exec` IAM role is updated with permissions for SageMaker invocation and Amazon Polly.
* [ ] The `transcribe_proxy` Lambda is updated to use the SageMaker endpoint instead of the public Hugging Face API.
* [ ] The `bedrock_proxy` Lambda successfully sends its text response to Amazon Polly to synthesize speech and save it to S3.