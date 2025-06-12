import React from 'react';

interface UploadProgressProps {
  progress: number;
  status: string;
}

export default function UploadProgress({ progress, status }: UploadProgressProps) {
  return (
    <div className="w-full space-y-2">
      <div className="w-full bg-zinc-700 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{status}</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}