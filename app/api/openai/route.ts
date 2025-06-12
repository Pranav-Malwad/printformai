import { NextRequest, NextResponse } from 'next/server';
import { OpenAIAssistant } from '@/app/lib/openai-assistant';
import { mkdir } from 'fs/promises';
import { join } from 'path';

// Ensure storage directory exists
async function ensureStorageExists() {
  try {
    const STORAGE_DIR = join(process.cwd(), 'storage', 'documents');
    await mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating storage directory:', error);
    // In serverless environments, we might not have write access to the filesystem
    // Just log the error and continue - the app will fall back to not using RAG
  }
}

// Set a timeout for the entire API request - reduced for Netlify compatibility
const API_TIMEOUT = 25000; // 25 seconds (Netlify functions timeout at 30s)

export async function POST(request: NextRequest) {
  // Create a controller for the timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  
  // Define question variable in the outer scope so it's accessible in catch blocks
  let question = '';
  
  try {
    console.log('OpenAI API route called');
    
    // Get the OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { question: rawQuestion, resetThread = false, useRAG = true, threadId = null } = body;

    if (!rawQuestion) {
      console.error('Question is missing in the request');
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Limit question length to prevent issues with extremely long inputs
    const MAX_QUESTION_LENGTH = 1000; // Reduced from 2000 to help with timeouts
    question = rawQuestion.length > MAX_QUESTION_LENGTH 
      ? rawQuestion.substring(0, MAX_QUESTION_LENGTH) + "... [truncated due to length]"
      : rawQuestion;

    console.log(`Processing question: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`);
    console.log(`Question length: ${question.length} chars, Reset thread: ${resetThread}, Use RAG: ${useRAG}, Thread ID: ${threadId}`);

    // Ensure storage directory exists for RAG
    await ensureStorageExists();

    try {
      // Create a new assistant instance for each request (stateless approach)
      console.log('Initializing new OpenAI Assistant instance');
      
      // Log the request parameters for debugging
      console.log('Request parameters:', {
        questionLength: question.length,
        resetThread,
        useRAG,
        threadId: threadId || 'null'
      });
      
      // Validate API key format (basic check)
      if (!apiKey.startsWith('sk-')) {
        console.error('Invalid API key format');
        return NextResponse.json(
          { error: 'Invalid OpenAI API key format' },
          { status: 500 }
        );
      }
      
      try {
        const assistantInstance = new OpenAIAssistant(apiKey);
        
        // Initialize with the thread ID if provided
        console.log('Initializing assistant with thread ID:', threadId);
        await assistantInstance.initialize(
          `You are a support assistant for Printform Manufacturing Company. Help employees and new users by:
- Answering questions about Printform's manufacturing services (CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing)
- Explaining manufacturing processes and capabilities
- Providing information about materials, tolerances, and design guidelines
- Assisting with order processes and production timelines
- Troubleshooting common issues with manufacturing processes
- Providing information about Printform's digital products and platforms

Be professional, accurate, and helpful. If you don't know the answer, say so clearly rather than making up information.

Printform Manufacturing Company provides custom parts manufacturing on demand services, including:
1. CNC Machining - For precision metal and plastic parts
2. Injection Molding - For high-volume plastic parts production
3. Sheet Metal Fabrication - For metal enclosures, brackets, and panels
4. Cast Urethane - For flexible parts and low-volume production
5. 3D Printing - For rapid prototyping and complex geometries

They serve various industries including consumer products, energy, medical, and oil and gas sectors.

IMPORTANT: Printform also offers digital products, including:
- MCloud: A proprietary platform developed exclusively by Printform, accessible at https://paasport.printform.com/paasport/login. MCloud is Printform's cloud-based manufacturing management system that helps customers track orders, manage projects, and streamline their manufacturing workflow. When users ask about MCloud, always emphasize that it is Printform's exclusive product and provide information about its features and benefits for manufacturing management.`,
          threadId
        );

        // Set RAG usage based on request
        console.log('Setting RAG usage:', useRAG);
        assistantInstance.setUseRAG(useRAG);

        // Create a promise that will be rejected if the controller aborts
        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Request timed out after 25 seconds'));
          });
        });

        // Get response from OpenAI with timeout
        console.log('Getting response from OpenAI');
        const result = await Promise.race([
          assistantInstance.getResponse(question),
          abortPromise
        ]);
        
        // Extract the answer and thread ID
        const { answer, threadId: newThreadId } = result;
        
        console.log(`Received answer (${answer.length} chars), Thread ID: ${newThreadId}`);

        // Clear the timeout
        clearTimeout(timeoutId);

        // Return the response with the thread ID
        return NextResponse.json({ 
          answer,
          threadId: newThreadId
        });
      } catch (assistantError: any) {
        // More detailed error for assistant initialization or processing
        console.error('Error with assistant:', assistantError);
        console.error('Error stack:', assistantError.stack);
        
        // Return a more detailed error response
        return NextResponse.json(
          { 
            error: `Assistant error: ${assistantError.message || 'Unknown assistant error'}`,
            details: assistantError.stack,
            resetRequired: true 
          },
          { status: 500 }
        );
      }
    } catch (openaiError: any) {
      console.error('Error with OpenAI service:', openaiError);
      console.error('Error stack:', openaiError.stack);
      
      // Check if it's a timeout error
      const isTimeout = 
        openaiError.message?.includes('timed out') || 
        openaiError.name === 'AbortError' ||
        openaiError.code === 'ETIMEDOUT';
      
      // Provide a user-friendly error message
      let errorMessage = openaiError.message || 'An error occurred with the OpenAI service';
      if (isTimeout) {
        errorMessage = 'The AI service is taking too long to respond. Please try again with a simpler question.';
      } else if (openaiError.message?.includes('rate limit')) {
        errorMessage = 'The AI service is currently experiencing high demand. Please try again in a few minutes.';
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: openaiError.stack,
          resetRequired: true 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in OpenAI API route:', error);
    console.error('Error stack:', error.stack);
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Check if we're running in Netlify environment
    const isNetlify = process.env.NETLIFY === 'true';
    console.log('Running in Netlify environment:', isNetlify);
    
    // Check if it's an abort error
    if (error.name === 'AbortError') {
      // For timeout errors in Netlify, provide a fallback response
      if (isNetlify) {
        console.log('Providing fallback response for timeout in Netlify environment');
        return NextResponse.json({ 
          answer: `I'm sorry, but I couldn't process your question about "${question.substring(0, 30)}..." in time. Netlify functions have a 30-second timeout limit. Please try asking a shorter or simpler question.`,
          threadId: null,
          fallback: true
        });
      } else {
        return NextResponse.json(
          { 
            error: 'Request timed out after 25 seconds. Please try again with a simpler question.',
            resetRequired: true 
          },
          { status: 504 } // Gateway Timeout
        );
      }
    }
    
    // For other errors in Netlify, also provide a fallback response
    if (isNetlify) {
      console.log('Providing fallback response for general error in Netlify environment');
      return NextResponse.json({ 
        answer: `I apologize, but I encountered an error while processing your question. This might be due to Netlify's serverless function limitations. Please try again with a shorter question or try again later.`,
        threadId: null,
        fallback: true
      });
    }
    
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}