import { useState } from 'react';
import { useAuth } from "react-oidc-context";
import './App.css';
import FileUpload from './components/FileUpload';
import PdfViewer from './components/PdfViewer';

function App() {
  const auth = useAuth();
  const [pdfUrl, setPdfUrl] = useState('');
  const [showAvatar, setShowAvatar] = useState(false);

  const handleSignOut = () => {
    auth.removeUser();
    window.location.reload();
  };
  
  const handleUploadSuccess = (url) => {
    setPdfUrl(url);
    setShowAvatar(true);
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
            <FileUpload onUploadSuccess={handleUploadSuccess} />
            <PdfViewer fileUrl={pdfUrl} />
          </main>
          <aside>
            <h2>AI Avatar</h2>
            {showAvatar ? (
               <canvas id="avatar-canvas" style={{ border: '1px solid #ccc', borderRadius: '8px', width: '100%', height: '400px', backgroundColor: '#f0f0f0' }}>
                 {/* 3D Avatar will be rendered here in Sprint 6 */}
               </canvas>
            ) : (
              <div style={{ border: '1px solid #ccc', borderRadius: '8px', width: '100%', height: '400px', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <p>Avatar will appear here.</p>
              </div>
            )}
            <div style={{marginTop: '20px'}}>
              <input type="text" placeholder="Ask a question about the PDF..." style={{width: 'calc(100% - 22px)', padding: '10px'}}/>
              <button style={{width: '100%', marginTop: '10px', padding: '10px'}} disabled>Ask (Text)</button>
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

