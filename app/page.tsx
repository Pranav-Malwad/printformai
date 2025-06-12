"use client";

import { useEffect } from "react";
import InteractiveAvatar from "@/components/InteractiveAvatar";
import { initializeStorage } from './actions';

export default function App() {
  // Initialize storage when the app loads
  useEffect(() => {
    // Initialize storage directories
    initializeStorage().catch(error => {
      console.error('Failed to initialize storage:', error);
    });
    
    // Add global error handler to suppress DataChannel errors
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.error && 
          (event.error.message?.includes('Unknown DataChannel error') || 
           event.error.message?.includes('DataChannel'))) {
        // Prevent the error from being reported to the console
        event.preventDefault();
        return true;
      }
      return false;
    };
    
    // Add the error handler
    window.addEventListener('error', handleGlobalError);
    
    // Clean up
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col">
     
      <div className="w-[900px] flex flex-col items-start justify-start gap-5 mx-auto pt-4 pb-20">
        <div className="w-full">
          <InteractiveAvatar />
        </div>
      </div>
    </div>
  );
}
