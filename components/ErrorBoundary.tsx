'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // If the error is a DataChannel error, don't show the error UI
    if (error.message && (
        error.message.includes('Unknown DataChannel error') || 
        error.message.includes('DataChannel')
    )) {
      return { hasError: false, error: null };
    }
    
    // For other errors, update state to show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // If it's not a DataChannel error, log it
    if (!(error.message && (
        error.message.includes('Unknown DataChannel error') || 
        error.message.includes('DataChannel')
    ))) {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900 text-white rounded-lg">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="mb-4">The application encountered an error. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-white text-red-900 font-medium rounded hover:bg-gray-100"
          >
            Refresh Page
          </button>
          {this.state.error && (
            <div className="mt-4 p-2 bg-red-800 rounded">
              <p className="font-mono text-sm">{this.state.error.toString()}</p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;