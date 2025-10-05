import React, { useState, useRef } from 'react';
import WavEncoder from 'wav-encoder';

const VoiceRecorder = ({ onTranscriptionComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    const toggleRecording = async () => {
        if (isRecording) {
            console.log("Stopping recording...");
            mediaRecorder.current.stop();
            setIsRecording(false);
        } else {
            console.log("Starting recording...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder.current = new MediaRecorder(stream);
                audioChunks.current = [];

                mediaRecorder.current.ondataavailable = (event) => {
                    audioChunks.current.push(event.data);
                };

                mediaRecorder.current.onstop = async () => {
                    console.log("Recording stopped. Processing audio...");
                    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                    await   processAndSendAudio(audioBlob);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.current.start();
                setIsRecording(true);

            } catch (error) {
                console.error("Error accessing microphone:", error);
            }
        }
    };

    // New, robust function to convert ArrayBuffer to Base64
    const bufferToBase64 = (buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    const processAndSendAudio = async (audioBlob) => {
        console.log(`Step 1: Received audioBlob of size ${audioBlob.size}`);
        try {
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const pcmData = audioBuffer.getChannelData(0);
            console.log(`Step 2: Decoded to PCM data with length ${pcmData.length}`);

            const wavBuffer = await WavEncoder.encode({
                sampleRate: 16000,
                channelData: [pcmData],
            });
            console.log(`Step 3: Encoded to WAV buffer of size ${wavBuffer.byteLength}`);

            const audio_b64 = bufferToBase64(wavBuffer);
            console.log(`Step 4: Converted to Base64 string, preparing HTTP request...`);

            const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL}/transcribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio_data: audio_b64
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Step 6: Received transcript from backend:", data.transcript);

            if (data.transcript) {
                onTranscriptionComplete(data.transcript);
            }

        } catch (error) {
            console.error("Error processing or sending audio:", error);
        }
    };
    
    return (
        <button onClick={toggleRecording} style={{ backgroundColor: isRecording ? '#dc3545' : '#007bff' }}>
            {isRecording ? 'Stop Speaking' : 'Press to Talk'}
        </button>
    );
};

export default VoiceRecorder;