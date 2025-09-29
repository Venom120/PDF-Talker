import { useState } from 'react';
import { useAuth } from "react-oidc-context";
import './App.css';
import FileUpload from './components/FileUpload';
import PdfViewer from './components/PdfViewer';

function App() {
  const auth = useAuth();
  
  // State for the PDF viewer
  const [pdfUrl, setPdfUrl] = useState('');
  const [s3Key, setS3Key] = useState(''); // To store the document_id

  // State for the Q&A component
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = () => {
    auth.signoutRedirect({ post_logout_redirect_uri: window.location.origin });
  };
  
  const handleUploadSuccess = (url, key) => {
    setPdfUrl(url);
    setS3Key(key);
  };

  const handleQuerySubmit = async () => {
    if (!query || !s3Key) {
      setAnswer("Please upload a document and ask a question.");
      return;
    }

    setIsLoading(true);
    setAnswer('');

    try {
      const token = auth.user?.id_token;
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: query,
          document_id: s3Key,
        }),
      });
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log(data);
      setAnswer(data.answer);

    } catch (error) {
      console.error("Error fetching answer:", error);
      setAnswer(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div className="App">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #444' }}>
          <h1>Welcome, {auth.user?.profile.email}</h1>
          <button onClick={handleSignOut}>Sign Out</button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', padding: '1rem' }}>
          <main>
            <FileUpload onUploadSuccess={handleUploadSuccess} auth={auth} />
            <PdfViewer fileUrl={pdfUrl} />
          </main>
          <aside>
            <h2>AI Assistant</h2>
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', width: '100%', height: '400px', backgroundColor: '#6e6e6eff', padding: '10px', boxSizing: 'border-box', overflowY: 'auto' }}>
              {isLoading ? <p>Thinking...</p> : <p>{answer || "Ask a question to see the answer here."}</p>}
            </div>
            <div style={{marginTop: '20px'}}>
              <input 
                type="text" 
                placeholder="Ask a question about the PDF..." 
                style={{width: 'calc(100% - 22px)', padding: '10px'}}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleQuerySubmit()}
              />
              <button 
                style={{width: '100%', marginTop: '10px', padding: '10px'}} 
                onClick={handleQuerySubmit} 
                disabled={isLoading || !s3Key}
              >
                {isLoading ? 'Asking...' : 'Ask (Text)'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div style={{textAlign: 'center', marginTop: '50px'}}>
      <h1>PDF Talker</h1>
      <p>Please sign in to continue.</p>
      <button onClick={() => auth.signinRedirect()}>Sign In</button>
    </div>
  );
}

export default App;