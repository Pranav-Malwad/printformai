import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readdir, readFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { STORAGE_DIR as configuredStorageDir, initializeStorage } from '@/app/lib/init-storage';

// Helper function to safely perform file operations
const safeFileOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error("File operation failed:", error);
    return fallback;
  }
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the storage directory for documents
const STORAGE_DIR = global.STORAGE_DIR || configuredStorageDir || join(process.cwd(), 'storage', 'documents');

// Ensure storage directory exists
async function ensureStorageExists() {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    
    // Skip file operations in browser environment
    if (isBrowser) {
      console.log('Running in browser environment, skipping file operations');
      return;
    }
    
    // Initialize storage using the shared function
    await initializeStorage();
    
    // Use the global storage directory or fall back to the local one
    const dirToUse = global.STORAGE_DIR || STORAGE_DIR;
    console.log(`Using storage directory: ${dirToUse}`);
  } catch (error) {
    console.error('Error ensuring storage exists:', error);
    // In serverless environments, we might not have write access
    // Just log the error and continue
  }
}

// Create embedding for query
async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  
  return response.data[0].embedding;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Find relevant chunks for a query
async function findRelevantChunks(queryEmbedding: number[], limit: number = 5) {
  // Ensure storage directory exists
  await ensureStorageExists();
  
  try {
    const dirToUse = global.STORAGE_DIR || STORAGE_DIR;
    console.log(`Looking for documents in: ${dirToUse}`);
    
    // Safely read directory
    const files = await safeFileOperation(
      () => readdir(dirToUse),
      []
    );
    
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} JSON files`);
    
    let allChunks: any[] = [];
    
    // Load all chunks from all documents
    for (const file of jsonFiles) {
      try {
        const content = await safeFileOperation(
          () => readFile(join(dirToUse, file), 'utf-8'),
          '{}'
        );
        
        const data = JSON.parse(content);
        if (data.chunks && Array.isArray(data.chunks)) {
          console.log(`Adding ${data.chunks.length} chunks from ${file}`);
          allChunks = allChunks.concat(data.chunks);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError);
        // Continue with other files
      }
    }
  
    // If no chunks found, return empty array
    if (allChunks.length === 0) {
      console.log('No chunks found in any documents');
      return [];
    }
    
    console.log(`Processing ${allChunks.length} total chunks`);
    
    // Calculate similarity for each chunk
    const chunksWithSimilarity = allChunks
      .filter(chunk => chunk && chunk.embedding) // Ensure chunk has embedding
      .map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }));
    
    // Sort by similarity and take the top results
    const results = chunksWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(chunk => ({
        content: chunk.content,
        metadata: chunk.metadata || { source: 'unknown' },
        similarity: chunk.similarity,
      }));
    
    console.log(`Returning ${results.length} relevant chunks`);
    return results;
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    return []; // Return empty array on error
  }
}

// Generate answer using OpenAI
async function generateAnswer(query: string, relevantChunks: any[]) {
  // Check if we have any relevant chunks
  const hasContext = relevantChunks && relevantChunks.length > 0;
  
  // Prepare context from relevant chunks if available
  const context = hasContext 
    ? relevantChunks.map(chunk => chunk.content).join('\n\n')
    : '';
  
  // Create prompt with context and query
  let prompt;
  
  if (hasContext) {
    prompt = `
You are a support assistant for Printform Manufacturing Company, a company that provides custom parts manufacturing on demand services, including CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing.

Use the following information to answer the question:

${context}

Question: ${query}

IMPORTANT RESPONSE GUIDELINES:
1. Format your response as a concise summary with bullet points
2. Keep your answer brief and to the point
3. Highlight only the most important information
4. Use short, clear sentences
5. Avoid unnecessary details or explanations
6. If the information provided doesn't contain the answer, say so clearly and provide 2-3 bullet points with general information

Your goal is to provide the most value with the fewest words possible.
`;
  } else {
    // No context available, use general knowledge
    prompt = `
You are a support assistant for Printform Manufacturing Company, a company that provides custom parts manufacturing on demand services, including CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing.

Question: ${query}

IMPORTANT RESPONSE GUIDELINES:
1. Format your response as a concise summary with bullet points
2. Keep your answer brief and to the point (maximum 3-5 bullet points)
3. Highlight only the most important information
4. Use short, clear sentences
5. Avoid unnecessary details or explanations
6. Provide only general information that might be useful

Your goal is to provide the most value with the fewest words possible. If you don't know the specific answer, provide 2-3 bullet points with general information and suggest contacting Printform directly.
`;
  }

  try {
    // Generate completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { 
          role: 'system', 
          content: 'You are a knowledgeable support assistant for Printform Manufacturing Company. Always respond with concise bullet points to save tokens. Summarize information clearly and avoid lengthy explanations. Focus on delivering maximum value with minimum words.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800, // Reduced from 1000 to encourage brevity
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating answer with OpenAI:', error);
    
    // Provide a fallback response if OpenAI fails
    return `• I apologize, but I'm having trouble generating a response at the moment.
• Printform Manufacturing Company provides custom parts manufacturing services including CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing.
• Please try your question again later or contact Printform directly at info@printform.com for assistance.`;
  }
}

// API route handler
export async function POST(request: NextRequest) {
  try {
    // Ensure storage directory exists
    await ensureStorageExists();
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { query } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    try {
      // Create embedding for the query
      const queryEmbedding = await createEmbedding(query);
      
      // Find relevant chunks
      const relevantChunks = await findRelevantChunks(queryEmbedding);
      
      // Generate answer (with or without chunks)
      const answer = await generateAnswer(query, relevantChunks);
      
      return NextResponse.json({
        answer,
        sources: relevantChunks,
      });
    } catch (processingError: any) {
      console.error('Error processing query:', processingError);
      
      // Fallback to direct answer without RAG if there's an error
      try {
        const fallbackAnswer = await generateAnswer(query, []);
        return NextResponse.json({
          answer: fallbackAnswer,
          sources: [],
          note: "Used fallback mode due to processing error"
        });
      } catch (fallbackError) {
        throw new Error(`Failed to process query: ${processingError.message}`);
      }
    }
  } catch (error: any) {
    console.error('Error querying knowledge base:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to query knowledge base' },
      { status: 500 }
    );
  }
}