'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('manual');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const response = await fetch('/api/knowledge/vectorize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }

      const data = await response.json();
      setMessage(`Document processed successfully! ID: ${data.document.id}`);
      setFile(null);
      
      // Refresh the page after 3 seconds
      setTimeout(() => {
        router.refresh();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading the document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload Knowledge Base Documents</h1>
      
      <div className="bg-zinc-800 p-6 rounded-lg shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Document Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 bg-zinc-700 rounded border border-zinc-600 focus:ring-2 focus:ring-blue-500"
            >
              <option value="manual">User Manual</option>
              <option value="guide">Guide</option>
              <option value="faq">FAQ</option>
              <option value="mcloud">MCloud</option>
              <option value="printform">PrintForm</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Upload Document (PDF or TXT)</label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="w-full p-2 bg-zinc-700 rounded border border-zinc-600 focus:ring-2 focus:ring-blue-500"
            />
            {file && (
              <p className="mt-2 text-sm text-green-400">
                Selected file: {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isUploading || !file}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 rounded font-medium transition-colors"
          >
            {isUploading ? 'Processing...' : 'Upload & Process'}
          </button>
        </form>
        
        {message && (
          <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-400">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-400">
            {error}
          </div>
        )}
        
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-2">Instructions</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Upload PDF or TXT files to add to the knowledge base</li>
            <li>Select the appropriate category for better organization</li>
            <li>Files will be processed and converted to embeddings</li>
            <li>Large files may take longer to process</li>
            <li>For manual processing of multiple files, place PDFs in the <code>/storage/pdf-uploads</code> directory and run <code>node scripts/process-pdf-docs.js</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}