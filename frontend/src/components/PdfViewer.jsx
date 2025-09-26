import React, { useEffect, useRef, useState } from 'react';
import { getDocument } from 'pdfjs-dist';

// Set up the worker source for pdf.js from a CDN
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
window.pdfjsWorker = pdfjsWorker;


function PdfViewer({ fileUrl }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileUrl) return;

    setError(null);
    // Use the getDocument method from the imported library
    const loadingTask = getDocument(fileUrl);
    
    loadingTask.promise.then(loadedPdf => {
      setPdf(loadedPdf);
      setNumPages(loadedPdf.numPages);
    }).catch(err => {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF. Check the file URL and CORS settings for your S3 bucket.");
    });
  }, [fileUrl]);

  useEffect(() => {
    if (!pdf) return;

    pdf.getPage(currentPage).then(page => {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1.5 });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      page.render({
        canvasContext: context,
        viewport: viewport,
      });
    });
  }, [pdf, currentPage]);

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(numPages, prev + 1));
  };

  return (
    <div style={{ marginTop: '20px' }}>
      {error && <p style={{color: 'red'}}>{error}</p>}
      {fileUrl && !error ? (
        <div>
          <div style={{ margin: '10px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
            <button onClick={goToPreviousPage} disabled={currentPage <= 1}>
              Previous Page
            </button>
            <span>
              Page {currentPage} of {numPages}
            </span>
            <button onClick={goToNextPage} disabled={currentPage >= numPages}>
              Next Page
            </button>
          </div>
          <canvas ref={canvasRef} style={{ border: '1px solid black' }} />
        </div>
      ) : (
        <p>Upload a PDF to view it here.</p>
      )}
    </div>
  );
}

export default PdfViewer;

