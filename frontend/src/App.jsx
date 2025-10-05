import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import FileUpload from './components/FileUpload';
import PdfViewer from './components/PdfViewer';
import VoiceRecorder from './components/VoiceRecorder';
import './App.css';

// OIDC Configuration for Cognito
const oidcConfig = {
  authority: `https://cognito-idp.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
};

function App() {
  return (
    <AuthProvider {...oidcConfig}>
      <MainContent />
    </AuthProvider>
  );
}

function MainContent() {
  const auth = useAuth();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [s3Key, setS3Key] = useState(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const chatEndRef = useRef(null);

  // Effect to scroll to the bottom of the chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Handle successful file upload
  const handleUploadSuccess = async (url, key) => {
    setPdfUrl(url);
    setS3Key(key);
    setChatHistory([]); // Clear old history immediately

    // Fetch existing chat history for the new document
    try {
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL}/history?document_id=${key}`, {
        headers: {
          'Authorization': `Bearer ${auth.user?.id_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch chat history');
      
      const historyData = await response.json();
      const formattedHistory = historyData.map(item => ({
          user: item.user_query,
          ai: item.ai_response
      }));
      setChatHistory(formattedHistory);

    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  // Handle sending a query to the AI
  const handleAsk = async (textQuery) => {
    if (!textQuery || !s3Key || isLoading) return;
    setIsLoading(true);
    
    // Optimistically update UI
    const newHistory = [...chatHistory, { user: textQuery, ai: '' }];
    setChatHistory(newHistory);
    setQuery('');

    try {
        const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.user?.id_token}` },
            body: JSON.stringify({ query: textQuery, document_id: s3Key }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        // Update the last message in the history with the final AI response
        setChatHistory(prevHistory => {
            const updated = [...prevHistory];
            updated[updated.length - 1].ai = data.response_text;
            return updated;
        });

        if (data.audio_url) {
            const audio = new Audio(data.audio_url);
            audio.play();
        }

    } catch (error) {
        console.error('Error fetching AI response:', error);
        // On error, revert the optimistic UI update
        setChatHistory(chatHistory); 
    } finally {
        setIsLoading(false);
    }
  };

  // Handle clearing the chat history
  const handleClearHistory = async () => {
    if (!s3Key) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL}/history?document_id=${s3Key}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.user?.id_token}` }
      });
      if (!response.ok) throw new Error('Failed to clear chat history');
      setChatHistory([]);
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  };
  
  // Handle transcription from voice recorder
  const handleTranscriptionComplete = (transcript) => {
    if (transcript.trim()) {
      handleAsk(transcript.trim());
    }
  };

  if (auth.isLoading) return <div style={{justifyContent: 'center'}}>Loading authentication...</div>;

  if (!auth.isAuthenticated) {
    return (
      <div className="login-container">
        <h1>PDF Talker</h1>
        <p>Please log in to continue.</p>
        <button onClick={() => auth.signinRedirect()}>Log in</button>
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <h1>Welcome, {auth.user?.profile.email}</h1>
        <button onClick={() => auth.signoutRedirect()}>Log out</button>
      </header>
      <div className="main-grid">
        <main>
          <FileUpload onUploadSuccess={handleUploadSuccess} auth={auth} />
          {pdfUrl && <PdfViewer fileUrl={pdfUrl} />}
        </main>
        <aside>
          <div className="ai-assistant-header">
            <h2>AI Assistant</h2>
            {s3Key && (
              <button onClick={handleClearHistory} className="clear-history-btn">
                Clear History
              </button>
            )}
          </div>
          <div className="chat-box">
            {chatHistory.length === 0 && <p className="chat-placeholder">Ask a question to begin.</p>}
            {chatHistory.map((chat, index) => (
              <div key={index} className="chat-message">
                <p><strong>You:</strong> {chat.user}</p>
                <p><strong>AI:</strong> {isLoading && index === chatHistory.length - 1 ? <span className="thinking">Thinking...</span> : chat.ai}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="input-area">
            {isVoiceMode ? (
              <VoiceRecorder onTranscriptionComplete={handleTranscriptionComplete} />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Ask a question about the PDF..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk(query)}
                />
                <button onClick={() => handleAsk(query)} disabled={isLoading || !s3Key}>
                  {isLoading ? 'Asking...' : 'Ask'}
                </button>
              </>
            )}
          </div>
          <div className="toggle-switch">
            <span>Text</span>
            <label className="switch">
              <input type="checkbox" checked={isVoiceMode} onChange={() => setIsVoiceMode(!isVoiceMode)} />
              <span className="slider round"></span>
            </label>
            <span>Voice</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
