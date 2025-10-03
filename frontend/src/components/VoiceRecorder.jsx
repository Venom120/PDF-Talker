import React, { useState, useRef } from 'react';
import { Buffer } from 'buffer';

const VoiceRecorder = ({ onTranscription }) => {
  const [isRecording, setIsRecording] = useState(false);
  const socket = useRef(null);
  const stream = useRef(null);
  const audioProcessor = useRef(null);

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);

    try {
      // 1. Get user's microphone stream
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Open WebSocket connection
      socket.current = new WebSocket(import.meta.env.VITE_WEBSOCKET_API_ENDPOINT);

      socket.current.onopen = async () => {
        // 3. Start sending audio data
        const audioContext = new (window.AudioContext || window.AudioContext)();
        await audioContext.audioWorklet.addModule('/src/audio/recorder-processor.js');
        const source = audioContext.createMediaStreamSource(stream.current);
        audioProcessor.current = new AudioWorkletNode(audioContext, 'recorder-processor');

        audioProcessor.current.port.onmessage = (event) => {
          if (event.data.type === 'audioData') {
            const pcmData = new Int16Array(event.data.pcmData);
            const buffer = Buffer.from(pcmData.buffer);
            if (socket.current.readyState === WebSocket.OPEN) {
              socket.current.send(buffer);
            }
          }
        };

        source.connect(audioProcessor.current);
        audioProcessor.current.connect(audioContext.destination);
      };

      socket.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.transcript) {
          onTranscription(data.transcript);
        }
      };

    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);

    // Stop microphone stream and close socket
    if (stream.current) {
      stream.current.getTracks().forEach(track => track.stop());
    }
    if (audioProcessor.current) {
      audioProcessor.current.disconnect();
    }
    if (socket.current) {
      socket.current.close();
    }
  };

  return (
    <div>
      <button onMouseDown={startRecording} onMouseUp={stopRecording}>
        {isRecording ? 'Recording...' : 'Hold to Talk'}
      </button>
    </div>
  );
};

export default VoiceRecorder;