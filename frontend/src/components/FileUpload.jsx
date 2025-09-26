import React, { useState } from 'react';

// Vite exposes environment variables via import.meta.env
const API_ENDPOINT = import.meta.env.VITE_API_GATEWAY_ENDPOINT_URL;
const S3_BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME;
const AWS_REGION = import.meta.env.VITE_AWS_REGION;


function FileUpload({ onUploadSuccess }) {
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
    if (!API_ENDPOINT || !S3_BUCKET_NAME || !AWS_REGION) {
        setMessage('Error: Environment variables for API endpoint, bucket, or region are not set.');
        console.error("Missing environment variables");
        return;
    }

    setUploading(true);
    setMessage('Getting upload URL...');

    try {
      // 1. Get the presigned URL from your Lambda function
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: `uploads/${file.name}` }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get presigned URL.');
      }

      const { url: uploadURL, key: s3Key } = await response.json();
      setMessage('Uploading file...');

      // 2. Upload the file directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('S3 upload failed.');
      }

      setMessage('Upload successful!');
      
      const fileUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
      onUploadSuccess(fileUrl);

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

