'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeStorage } from '../actions';

interface ProcessedDocument {
  id: string;
  fileName: string;
  namespace: string;
  chunks: number;
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  // Initialize storage and fetch processed documents
  useEffect(() => {
    async function initAndFetchDocuments() {
      try {
        // Initialize storage directories first
        await initializeStorage();
        
        // Then fetch documents
        const response = await fetch('/api/knowledge/vectorize');
        const data = await response.json();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error('Error initializing or fetching documents:', error);
      }
    }

    initAndFetchDocuments();
  }, []);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Handle document upload
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const response = await fetch('/api/knowledge/vectorize', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        alert('Document uploaded and processed successfully!');
        setFile(null);
        // Refresh the document list
        const docsResponse = await fetch('/api/knowledge/vectorize');
        const docsData = await docsResponse.json();
        setDocuments(docsData.documents || []);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('An error occurred while uploading the document.');
    } finally {
      setUploading(false);
    }
  };

  // Handle query submission
  const handleQuery = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setAnswer('');
    setSources([]);

    try {
      const response = await fetch('/api/knowledge/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (response.ok) {
        setAnswer(data.answer);
        setSources(data.sources);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error querying knowledge base:', error);
      alert('An error occurred while querying the knowledge base.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Organization Knowledge Base</h1>

      {/* Document Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter document category"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Document</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full p-2 border rounded"
            accept=".pdf,.txt,.docx"
          />
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      {/* Query Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Ask a Question</h2>
        <div className="mb-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter your question here..."
            rows={3}
          />
        </div>
        <button
          onClick={handleQuery}
          disabled={!query.trim() || searching}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {searching ? 'Searching...' : 'Ask Question'}
        </button>
      </div>

      {/* Answer Section */}
      {answer && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Answer</h2>
          <div className="mb-4 whitespace-pre-line">{answer}</div>
          
          {sources.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Sources</h3>
              <ul className="list-disc pl-5">
                {sources.map((source, index) => (
                  <li key={index} className="mb-2">
                    <div className="text-sm text-gray-700">{source.content}</div>
                    <div className="text-xs text-gray-500">
                      Source: {source.metadata.source}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Document List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Processed Documents</h2>
        {documents.length === 0 ? (
          <p>No documents have been processed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">File Name</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Chunks</th>
                  <th className="px-4 py-2 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t">
                    <td className="px-4 py-2">{doc.fileName}</td>
                    <td className="px-4 py-2">{doc.namespace.split('_')[0]}</td>
                    <td className="px-4 py-2">{doc.chunks}</td>
                    <td className="px-4 py-2">
                      {new Date(doc.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}