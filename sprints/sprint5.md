# Sprint 5 — Voice I/O (ASR/TTS)

**Goal:** To add speech input and speech output, enabling users to talk to the agent and receive spoken responses. This moves the application from a text-only interface to a fully voice-interactive experience.

**Date Completed:** October 3, 2025

---

## Summary of Work Completed

This sprint successfully integrated real-time voice communication, making the AI assistant feel significantly more interactive and intuitive. As **Amazon Nova Sonic** was not available, we proceeded with **Option B**, the fallback plan, which involved a combination of AWS services.

1.  **Amazon Transcribe Integration (Speech-to-Text):**
    * We implemented a real-time transcription pipeline using **Amazon Transcribe's streaming API**.
    * The frontend was updated to capture microphone input (as PCM audio) and stream it to a new backend WebSocket API Gateway.
    * A new Lambda function, `transcribe_streaming_proxy`, was created to handle the WebSocket connection, forward the audio stream to Transcribe, and return the final transcript to the frontend once the user finishes speaking.

2.  **Amazon Polly Integration (Text-to-Speech):**
    * The `bedrock_proxy` Lambda was extended to take the transcribed text and, after receiving the LLM's response, send that text to **Amazon Polly**.
    * Polly synthesizes the text into an MP3 audio stream. We configured it to use the 'Aditi' voice for its clarity.
    * The Lambda now returns a presigned URL for the generated MP3 file, which is stored in the `assets` S3 bucket.

3.  **API Gateway and IAM Updates:**
    * A new **WebSocket API** was created in API Gateway to manage the real-time communication required for Amazon Transcribe.
    * The `pdf-talker-lambda-exec` IAM role was updated with permissions for `transcribe:StartStreamTranscriptionWebSocket` and `polly:SynthesizeSpeech`.

4.  **Frontend UI and Audio Handling:**
    * The frontend was updated with a "Hold to Talk" button, which initiates the microphone recording and streaming process.
    * The UI now displays the interim and final transcripts from Transcribe, providing real-time feedback to the user.
    * Upon receiving the presigned URL for the audio response, the frontend automatically plays the synthesized speech, completing the voice-to-voice interaction loop.

---

## Sprint 5 Acceptance Criteria (Checklist)

* [ ] The `pdf-talker-lambda-exec` IAM role is updated with permissions for Amazon Transcribe and Amazon Polly.
* [ ] A new WebSocket API is created in API Gateway to handle real-time audio streaming.
* [ ] A new Lambda function is created to manage the WebSocket connection and interface with Amazon Transcribe.
* [ ] The frontend can successfully capture microphone audio and stream it through the WebSocket to the backend.
* [ ] The `bedrock_proxy` Lambda is updated to send its text response to Amazon Polly for speech synthesis.
* [ ] The frontend receives and can play the synthesized audio response from Polly.
* [ ] The user can ask a question with their voice and receive a spoken answer from the AI.
* [ ] The full voice-based Q&A loop is working end-to-end without significant latency.