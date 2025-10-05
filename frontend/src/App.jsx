import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import FileUpload from './components/FileUpload';
import PdfViewer from './components/PdfViewer';
import VoiceRecorder from './components/VoiceRecorder';
import './App.css';

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
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const handleUploadSuccess = (url, key) => {
    setPdfUrl(url);
    setS3Key(key);
    setChatHistory([]); 
  };

  const handleAsk = async (textQuery) => {
    if (!textQuery || !s3Key) return;
    setIsLoading(true);
    setAiResponse('');

    const currentChat = { user: textQuery, ai: '' };
    setChatHistory([...chatHistory, currentChat]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.user?.id_token}`
        },
        body: JSON.stringify({
          query: textQuery,
          document_id: s3Key,
          chat_history: chatHistory.map(chat => `User: ${chat.user}\nAI: ${chat.ai}`).join('\n')
        }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      setAiResponse(data.response_text);

      const updatedHistory = [...chatHistory, { user: textQuery, ai: data.response_text }];
      setChatHistory(updatedHistory);


      if (data.audio_url) {
        const audio = new Audio(data.audio_url);
        audio.play();
      }

    } catch (error) {
      console.error('Error fetching AI response:', error);
      setAiResponse('An error occurred. Please check the console.');
    } finally {
      setIsLoading(false);
      setQuery('');
    }
  };

  const handleTranscriptionComplete = (transcript) => {
    if (transcript.trim()) {
      handleAsk(transcript.trim());
    }
  };

  useEffect(() => {
    if (auth.isAuthenticated) {
      // You can add logic here for when the user is authenticated
    }
  }, [auth.isAuthenticated]);


  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div>
        <p>Not logged in</p>
        <button onClick={() => auth.signinRedirect()}>Log in</button>
      </div>
    );
  }


  return (
    <div className="App">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #444' }}>
        <h1>Welcome, {auth.user?.profile.email}</h1>
        <button onClick={() => auth.signoutRedirect()}>Log out</button>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', padding: '1rem' }}>
        <main>
          <FileUpload onUploadSuccess={handleUploadSuccess} auth={auth} />
          {pdfUrl && <PdfViewer fileUrl={pdfUrl} />}
        </main>
        <aside>
          <h2>AI Assistant</h2>
          <div style={{ border: '1px solid #ccc', borderRadius: '8px', width: '100%', height: '400px', backgroundColor: '#6e6e6eff', padding: '10px', boxSizing: 'border-box', overflowY: 'auto' }}>
          {chatHistory.map((chat, index) => (
            <div key={index}>
              <p><strong>You:</strong> {chat.user}</p>
              <p><strong>AI:</strong> {isLoading && index === chatHistory.length -1 ? "Thinking..." : chat.ai}</p>
            </div>
          ))}
          {aiResponse && !isLoading && (
              <div>
                  <p><strong>AI:</strong> {aiResponse}</p>
              </div>
          )}
          </div>

          {isVoiceMode ? (
            <VoiceRecorder onTranscriptionComplete={handleTranscriptionComplete} />
          ) : (
            <div style={{ marginTop: '20px' }}>
              <input
                type="text"
                placeholder="Ask a question about the PDF..."
                style={{ width: 'calc(100% - 22px)', padding: '10px' }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk(query)}
              />
              <button
                style={{ width: '100%', marginTop: '10px', padding: '10px' }}
                onClick={() => handleAsk(query)}
                disabled={isLoading || !s3Key}
              >
                {isLoading ? 'Asking...' : 'Ask (Text)'}
              </button>
            </div>
          )}
          <div className="toggle-switch">
            <span>Text Mode</span>
            <label className="switch">
              <input type="checkbox" checked={isVoiceMode} onChange={() => setIsVoiceMode(!isVoiceMode)} />
              <span className="slider round"></span>
            </label>
            <span>Voice Mode</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;