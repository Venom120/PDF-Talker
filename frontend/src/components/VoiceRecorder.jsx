import React, { useState, useRef } from 'react';
import { Buffer } from 'buffer';

// This is a simplified WebSocket-to-Transcribe handler.
// A production implementation would be more robust.
const VoiceRecorder = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const socket = useRef(null);
  const stream = useRef(null);
  const audioProcessor = useRef(null);
  const finalTranscript = useRef('');

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
      if (audioProcessor.current) {
        audioProcessor.current.disconnect();
      }
      if (socket.current) {
        // Wait a moment for the last transcription results to come in
        setTimeout(() => {
          socket.current.close();
          onTranscriptionComplete(finalTranscript.current);
          finalTranscript.current = '';
        }, 1500); // 1.5-second delay
      }
    } else {
      // Start recording
      setIsRecording(true);
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        socket.current = new WebSocket(import.meta.env.VITE_WEBSOCKET_API_ENDPOINT);

        socket.current.onopen = () => {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(stream.current);
          const processor = audioContext.createScriptProcessor(1024, 1, 1);

          processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = inputData[i] * 32767;
            }
            // 1. Convert binary audio to a Base64 string
            const audio_b64 = Buffer.from(pcmData.buffer).toString('base64');
            
            // 2. Send as a JSON object
            if (socket.current?.readyState === WebSocket.OPEN) {
              socket.current.send(JSON.stringify({ audio_data: audio_b64 }));
            }
          };
          source.connect(processor);
          processor.connect(audioContext.destination); // Connect to destination to hear audio (optional)
          audioProcessor.current = processor; // Store for cleanup
        };

        socket.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          // When the Lambda sends the final transcript, this will be triggered
          if (data.transcript) {
            // Pass the final, complete transcript up to the App component
            onTranscriptionComplete(data.transcript);
          }
        };
        
        socket.current.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setIsRecording(false);
        };

      } catch (error) {
        console.error("Error starting recording:", error);
        setIsRecording(false);
      }
    }
  };

  return (
    <button onClick={toggleRecording} style={{backgroundColor: isRecording ? 'red' : '#007bff', margin: 20}}>
      {isRecording ? 'Stop Recording' : 'Press to Talk'}
    </button>
  );
};

export default VoiceRecorder;