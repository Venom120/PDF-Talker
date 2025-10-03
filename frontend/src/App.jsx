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

  const handleUploadSuccess = (url, key) => {
    setPdfUrl(url);
    setS3Key(key);
  };

  const handleAsk = async () => {
    if (!query || !s3Key) return;
    setIsLoading(true);
    try {
      const response = await fetch(import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, document_id: s3Key }),
      });
      const data = await response.json();
      setAiResponse(data.response_text);

      // Play the audio response
      if (data.audio_url) {
        const audio = new Audio(data.audio_url);
        audio.play();
      }

    } catch (error) {
      console.error('Error fetching AI response:', error);
      setAiResponse('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscription = (transcript) => {
    setQuery(transcript);
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
            {isLoading ? <p>Thinking...</p> : <p>{aiResponse || "Ask a question to see the answer here."}</p>}
          </div>
          <div style={{marginTop: '20px'}}>
            <input 
                type="text" 
                placeholder="Ask a question about the PDF..." 
                style={{width: 'calc(100% - 22px)', padding: '10px'}}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyUp={(e) => e.key === 'Enter' && handleAsk()}
                />
            <button onClick={handleAsk} disabled={isLoading}>
              {isLoading ? 'Thinking...' : 'Ask'}
            </button>
            <VoiceRecorder onTranscription={handleTranscription} />
          </div>
        </aside>
      </div>
      <div className="avatar-placeholder">
        <p>3D Avatar</p>
      </div>
    </div>
  );
}

export default App;