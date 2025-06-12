import React, { useState } from 'react';

interface ErrorMessageProps {
  message: string;
  details?: string;
}

export default function ErrorMessage({ message, details }: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className="bg-red-900/50 text-red-300 p-3 rounded-lg">
      <div className="flex justify-between items-start">
        <p>{message}</p>
        {details && (
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs underline ml-2"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        )}
      </div>
      
      {showDetails && details && (
        <div className="mt-2 p-2 bg-red-950 rounded text-xs font-mono overflow-auto max-h-40">
          {details}
        </div>
      )}
    </div>
  );
}