import React, { useState } from 'react';

// The base URL for your API Gateway stage
const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL;

function FileUpload({ onUploadSuccess, auth }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setMessage('');
    } else {
      setFile(null);
      setMessage('Please select a valid PDF file.');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first.');
      return;
    }
    if (!API_BASE_URL) {
        setMessage('Error: API endpoint is not set in environment variables.');
        console.error("Missing VITE_API_GATEWAY_ENDPOINT_URL");
        return;
    }

    const token = auth.user?.id_token;
    if (!token) {
      setMessage('Authentication error: No token found. Please sign in again.');
      return;
    }

    // Construct the full URL by appending the correct route

    setUploading(true);
    setMessage('Getting secure upload URL...');

    try {
      // 1. Get BOTH presigned URLs from your Lambda function
      const response = await fetch(`${API_BASE_URL}/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ key: `uploads/${file.name}` }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Authorization failed. Check API Gateway authorizer settings.');
        }
        if (response.status === 404) {
            throw new Error(`Route not found. Ensure your API is deployed and the URL is correct: ${API_BASE_URL}/presign`);
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get presigned URL.');
      }

      const { uploadURL, getObjectURL, s3_key } = await response.json();
      setMessage('Uploading file...');

      // 2. Upload the file directly to S3
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('S3 upload failed. Check S3 CORS policy.');
      }

      setMessage('Upload successful!');
      onUploadSuccess(getObjectURL, s3_key);

    } catch (error) {
      console.error('Upload error:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
      <h2>Upload PDF</h2>
      <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} />
      <button onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default FileUpload;

