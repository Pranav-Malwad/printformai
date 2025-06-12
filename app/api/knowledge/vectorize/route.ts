import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { mkdir, readdir, readFile, stat } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromPDF } from '@/app/lib/pdf-utils';
import { initializeStorage, STORAGE_DIR as configuredStorageDir } from '@/app/lib/init-storage';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the storage directory for documents
const STORAGE_DIR = join(process.cwd(), 'storage', 'documents');

// Helper function to safely perform file operations
const safeFileOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error("File operation failed:", error);
    return fallback;
  }
};

// Ensure storage directory exists
async function ensureStorageExists() {
  try {
    console.log('[ENSURE-STORAGE] Starting storage verification...');
    console.log(`[ENSURE-STORAGE] Current working directory: ${process.cwd()}`);
    console.log(`[ENSURE-STORAGE] Environment: NODE_ENV=${process.env.NODE_ENV}, NETLIFY=${process.env.NETLIFY || 'not set'}`);
    
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    console.log(`[ENSURE-STORAGE] Browser environment detected: ${isBrowser}`);
    
    // Skip file operations in browser environment
    if (isBrowser) {
      console.log('[ENSURE-STORAGE] Running in browser environment, skipping file operations');
      return;
    }
    
    console.log('[ENSURE-STORAGE] Initializing storage using shared function...');
    // Initialize storage using the shared function
    await initializeStorage();
    console.log('[ENSURE-STORAGE] Storage initialization completed');
    
    // Use the global storage directory or fall back to the local one
    const dirToUse = global.STORAGE_DIR || STORAGE_DIR;
    console.log(`[ENSURE-STORAGE] Using storage directory: ${dirToUse}`);
    console.log(`[ENSURE-STORAGE] Global storage dir: ${global.STORAGE_DIR || 'not set'}`);
    console.log(`[ENSURE-STORAGE] Local storage dir: ${STORAGE_DIR}`);
    
    // Verify the directory exists and is writable
    try {
      // Ensure the directory exists
      console.log(`[ENSURE-STORAGE] Creating directory if it doesn't exist: ${dirToUse}`);
      await mkdir(dirToUse, { recursive: true });
      
      // Check directory permissions
      try {
        const dirStats = await stat(dirToUse);
        console.log(`[ENSURE-STORAGE] Directory stats - isDirectory: ${dirStats.isDirectory()}, mode: ${dirStats.mode.toString(8)}`);
      } catch (statError) {
        console.error(`[ENSURE-STORAGE] Failed to get directory stats: ${dirToUse}`, statError);
      }
      
      // Test write access by creating a test file
      const testFilePath = join(dirToUse, `test-write-${Date.now()}.txt`);
      console.log(`[ENSURE-STORAGE] Testing write access with test file: ${testFilePath}`);
      
      await writeFile(testFilePath, 'Test write access');
      console.log(`[ENSURE-STORAGE] Successfully wrote test file: ${testFilePath}`);
      
      // Try to read it back
      try {
        const content = await readFile(testFilePath, 'utf-8');
        console.log(`[ENSURE-STORAGE] Successfully read test file, content length: ${content.length}`);
      } catch (readError) {
        console.error(`[ENSURE-STORAGE] Failed to read test file: ${testFilePath}`, readError);
      }
      
      // Clean up test file (don't wait for this)
      writeFile(testFilePath, '').catch(e => console.log('[ENSURE-STORAGE] Cleanup error (non-critical):', e));
      
      console.log(`[ENSURE-STORAGE] Successfully verified write access to ${dirToUse}`);
    } catch (fsError) {
      console.error(`[ENSURE-STORAGE] ❌ Storage directory ${dirToUse} is not writable:`, fsError);
      console.error(`[ENSURE-STORAGE] Error details: ${fsError instanceof Error ? fsError.message : String(fsError)}`);
      console.error(`[ENSURE-STORAGE] Error stack: ${fsError instanceof Error ? fsError.stack : 'No stack trace'}`);
      
      // Try alternative directory for Netlify
      if (process.env.NETLIFY === 'true' && dirToUse !== '/tmp') {
        console.log('[ENSURE-STORAGE] Trying fallback to /tmp directory for Netlify...');
        global.STORAGE_DIR = '/tmp';
        throw new Error(`Storage directory ${dirToUse} is not writable, trying /tmp: ${fsError instanceof Error ? fsError.message : String(fsError)}`);
      }
      
      throw new Error(`Storage directory ${dirToUse} is not writable: ${fsError instanceof Error ? fsError.message : String(fsError)}`);
    }
    
    console.log('[ENSURE-STORAGE] Storage verification completed successfully');
  } catch (error) {
    console.error('[ENSURE-STORAGE] Error ensuring storage exists:', error);
    console.error(`[ENSURE-STORAGE] Error details: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[ENSURE-STORAGE] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    // In serverless environments, we might not have write access
    // Rethrow the error to handle it at a higher level
    throw new Error(`Failed to initialize storage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Save uploaded file
async function saveFile(file: File, category: string): Promise<string> {
  try {
    console.log(`[SAVE-FILE] Starting file save process for: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    console.log(`[SAVE-FILE] Category: ${category}`);
    
    await ensureStorageExists();
    console.log(`[SAVE-FILE] Storage initialization completed`);
    
    // Get array buffer and convert it to Uint8Array which is compatible with writeFile
    console.log(`[SAVE-FILE] Converting file to array buffer`);
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log(`[SAVE-FILE] File converted to Uint8Array, size: ${uint8Array.length} bytes`);
    
    // Sanitize filename to avoid path issues
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${category}_${Date.now()}_${sanitizedFileName}`;
    console.log(`[SAVE-FILE] Sanitized filename: ${fileName}`);
    
    // Get the storage directory
    const dirToUse = global.STORAGE_DIR || STORAGE_DIR;
    console.log(`[SAVE-FILE] Using storage directory: ${dirToUse}`);
    console.log(`[SAVE-FILE] Global storage dir: ${global.STORAGE_DIR || 'not set'}`);
    console.log(`[SAVE-FILE] Local storage dir: ${STORAGE_DIR}`);
    
    // Ensure the directory exists
    console.log(`[SAVE-FILE] Ensuring directory exists: ${dirToUse}`);
    try {
      await mkdir(dirToUse, { recursive: true });
      console.log(`[SAVE-FILE] Directory created or already exists: ${dirToUse}`);
      
      // Check directory permissions
      const dirStats = await stat(dirToUse);
      console.log(`[SAVE-FILE] Directory stats - isDirectory: ${dirStats.isDirectory()}, mode: ${dirStats.mode.toString(8)}`);
    } catch (mkdirError) {
      console.error(`[SAVE-FILE] Failed to create directory: ${dirToUse}`, mkdirError);
      console.error(`[SAVE-FILE] Mkdir error: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
      throw new Error(`Failed to create directory: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
    }
    
    // Create the full file path
    const filePath = join(dirToUse, fileName);
    console.log(`[SAVE-FILE] Full file path: ${filePath}`);
    
    // Try to write the file
    console.log(`[SAVE-FILE] Attempting to write file: ${filePath}, data size: ${uint8Array.length} bytes`);
    try {
      await writeFile(filePath, uint8Array);
      console.log(`[SAVE-FILE] File written successfully to: ${filePath}`);
    } catch (writeError) {
      console.error(`[SAVE-FILE] Failed to write file: ${filePath}`, writeError);
      console.error(`[SAVE-FILE] Write error: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
      console.error(`[SAVE-FILE] Write error stack: ${writeError instanceof Error ? writeError.stack : 'No stack trace'}`);
      throw new Error(`Failed to write file: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
    }
    
    // Verify the file was saved
    try {
      console.log(`[SAVE-FILE] Verifying file was saved: ${filePath}`);
      const stats = await stat(filePath);
      console.log(`[SAVE-FILE] File verification successful: ${filePath}, size: ${stats.size} bytes, isFile: ${stats.isFile()}, mode: ${stats.mode.toString(8)}`);
      
      // Additional verification - try to read the file
      try {
        console.log(`[SAVE-FILE] Attempting to read file for verification: ${filePath}`);
        const content = await readFile(filePath, { encoding: 'utf-8', flag: 'r' });
        console.log(`[SAVE-FILE] Read test successful, read ${content.length} characters`);
        console.log(`[SAVE-FILE] First 50 chars: ${content.substring(0, 50).replace(/\n/g, ' ')}`);
      } catch (readError) {
        console.error(`[SAVE-FILE] Read test failed:`, readError);
        console.error(`[SAVE-FILE] Read error details: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
    } catch (statError) {
      console.error(`[SAVE-FILE] File verification failed for ${filePath}:`, statError);
      console.error(`[SAVE-FILE] Stat error: ${statError instanceof Error ? statError.message : String(statError)}`);
      throw new Error(`File was not saved properly: ${statError instanceof Error ? statError.message : String(statError)}`);
    }
    
    console.log(`[SAVE-FILE] File save process completed successfully: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`[SAVE-FILE] Unhandled error in saveFile function:`, error);
    console.error(`[SAVE-FILE] Error details: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[SAVE-FILE] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    throw new Error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Process document and create embeddings
async function processDocument(filePath: string, category: string) {
  console.log(`[PROCESS-DOC] Starting document processing: ${filePath}, category: ${category}`);
  console.log(`[PROCESS-DOC] Current working directory: ${process.cwd()}`);
  console.log(`[PROCESS-DOC] Environment: NODE_ENV=${process.env.NODE_ENV}, NETLIFY=${process.env.NETLIFY || 'not set'}`);
  console.log(`[PROCESS-DOC] Global storage dir: ${global.STORAGE_DIR || 'not set'}`);
  
  // Determine file type and read content accordingly
  const fileExtension = extname(filePath).toLowerCase();
  console.log(`[PROCESS-DOC] File extension: ${fileExtension}`);
  
  let content: string;
  // Define these variables outside the try block so they're accessible throughout the function
  let namespace: string = `${category}_${uuidv4()}`;
  const processedChunks: any[] = [];
  
  try {
    // First, verify the file exists and is readable
    try {
      console.log(`[PROCESS-DOC] Verifying file exists: ${filePath}`);
      const fileStats = await stat(filePath);
      console.log(`[PROCESS-DOC] File stats - size: ${fileStats.size} bytes, isFile: ${fileStats.isFile()}, mode: ${fileStats.mode.toString(8)}`);
      
      if (fileStats.size === 0) {
        console.error(`[PROCESS-DOC] File exists but is empty: ${filePath}`);
        throw new Error('File is empty (0 bytes)');
      }
    } catch (statError) {
      console.error(`[PROCESS-DOC] File verification failed: ${filePath}`, statError);
      console.error(`[PROCESS-DOC] Stat error: ${statError instanceof Error ? statError.message : String(statError)}`);
      throw new Error(`File does not exist or is not accessible: ${statError instanceof Error ? statError.message : String(statError)}`);
    }
    
    if (fileExtension === '.pdf') {
      // Extract text from PDF
      console.log(`[PROCESS-DOC] Detected PDF file, extracting text from: ${filePath}`);
      content = await extractTextFromPDF(filePath);
      console.log(`[PROCESS-DOC] PDF text extraction result - length: ${content.length} characters`);
      console.log(`[PROCESS-DOC] First 100 chars: ${content.substring(0, 100).replace(/\n/g, ' ')}`);
      
      // Check if extraction failed
      if (content.startsWith('[PDF EXTRACTION FAILED:') || content.startsWith('Error extracting text from PDF:')) {
        console.error(`[PROCESS-DOC] PDF extraction failed: ${content}`);
        throw new Error(content);
      }
    } else {
      // Read text file content
      console.log(`[PROCESS-DOC] Reading text file: ${filePath}`);
      try {
        content = await readFile(filePath, 'utf-8');
        console.log(`[PROCESS-DOC] Text file read successfully, length: ${content.length} characters`);
        console.log(`[PROCESS-DOC] First 100 chars: ${content.substring(0, 100).replace(/\n/g, ' ')}`);
      } catch (readError) {
        console.error(`[PROCESS-DOC] Failed to read text file: ${filePath}`, readError);
        console.error(`[PROCESS-DOC] Read error: ${readError instanceof Error ? readError.message : String(readError)}`);
        throw new Error(`Failed to read text file: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
    }
    
    // Ensure we have content to process
    if (!content || content.trim().length === 0) {
      console.error(`[PROCESS-DOC] Document content is empty after extraction: ${filePath}`);
      throw new Error('Document content is empty after extraction');
    }
    
    // Split content into chunks (simple implementation - can be improved)
    console.log(`[PROCESS-DOC] Splitting content into chunks, total length: ${content.length}`);
    const chunks = splitIntoChunks(content, 1000);
    console.log(`[PROCESS-DOC] Split content into ${chunks.length} chunks`);
    
    // Create a namespace for this document
    namespace = `${category}_${uuidv4()}`;
    console.log(`[PROCESS-DOC] Created namespace: ${namespace}`);
    
    // Process each chunk and create embeddings
    console.log(`[PROCESS-DOC] Starting to process chunks and create embeddings`);
    for (let index = 0; index < chunks.length; index++) {
      console.log(`[PROCESS-DOC] Processing chunk ${index + 1}/${chunks.length}, length: ${chunks[index].length}`);
      const chunk = chunks[index];
      
      try {
        console.log(`[PROCESS-DOC] Creating embedding for chunk ${index + 1}`);
        const embedding = await createEmbedding(chunk);
        console.log(`[PROCESS-DOC] Embedding created successfully for chunk ${index + 1}, vector length: ${embedding.length}`);
        
        // Save the chunk with its embedding
        const chunkData = {
          id: `chunk_${index}`,
          content: chunk,
          embedding,
          metadata: {
            source: filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown',
            chunk: index,
            category,
            fileType: fileExtension.replace('.', '')
          }
        };
        
        // In a real implementation, you would store this in a vector database
        // For this demo, we'll just collect them
        processedChunks.push(chunkData);
        console.log(`[PROCESS-DOC] Chunk ${index + 1} processed and added to collection`);
      } catch (embeddingError) {
        console.error(`[PROCESS-DOC] Error creating embedding for chunk ${index + 1}:`, embeddingError);
        console.error(`[PROCESS-DOC] Embedding error: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`);
        // Continue with other chunks even if one fails
      }
    }
    
    // Check if we have any processed chunks
    if (processedChunks.length === 0) {
      console.error(`[PROCESS-DOC] Failed to process any chunks from the document: ${filePath}`);
      throw new Error('Failed to process any chunks from the document');
    }
    
    console.log(`[PROCESS-DOC] Successfully processed ${processedChunks.length} chunks`);
  } catch (error) {
    console.error(`[PROCESS-DOC] Error in document processing:`, error);
    console.error(`[PROCESS-DOC] Error details: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[PROCESS-DOC] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    throw error;
  }
  
  // Save document metadata
  const dirToUse = global.STORAGE_DIR || STORAGE_DIR;
  console.log(`[PROCESS-DOC] Using storage directory for saving metadata: ${dirToUse}`);
  
  const documentMetadata = {
    id: uuidv4(),
    fileName: filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown',
    namespace,
    chunks: processedChunks.length,
    createdAt: new Date().toISOString(),
    filePath,
    fileType: fileExtension.replace('.', '')
  };
  
  console.log(`[PROCESS-DOC] Document metadata prepared: ${JSON.stringify(documentMetadata, null, 2)}`);
  console.log(`[PROCESS-DOC] Saving document metadata and chunks to JSON file...`);
  
  // In a real implementation, you would store this in a database
  // For this demo, we'll save it to a JSON file
  const outputPath = join(dirToUse, `${namespace}.json`);
  console.log(`[PROCESS-DOC] Output path: ${outputPath}`);
  
  try {
    console.log(`[PROCESS-DOC] Writing document data to file: ${outputPath}`);
    await safeFileOperation(
      async () => {
        await writeFile(
          outputPath,
          JSON.stringify({
            metadata: documentMetadata,
            chunks: processedChunks,
          }, null, 2) // Pretty print for easier debugging
        );
      },
      undefined
    );
    
    // Verify the file was written
    try {
      const stats = await stat(outputPath);
      console.log(`[PROCESS-DOC] Document saved successfully to: ${outputPath}, size: ${stats.size} bytes`);
    } catch (statError) {
      console.error(`[PROCESS-DOC] Failed to verify document was saved: ${outputPath}`, statError);
    }
  } catch (writeError) {
    console.error(`[PROCESS-DOC] Error writing document to file:`, writeError);
    console.error(`[PROCESS-DOC] Write error: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
    throw new Error(`Failed to save document: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }
  
  console.log(`[PROCESS-DOC] Document processing completed successfully: ${documentMetadata.id}`);
  return documentMetadata;
}

// Split text into chunks
function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks = [];
  let currentChunk = '';
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size, save current chunk and start a new one
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    
    // Add paragraph to current chunk
    if (currentChunk.length > 0) {
      currentChunk += '\n\n';
    }
    currentChunk += paragraph;
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Create embedding for text
async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  
  return response.data[0].embedding;
}

// Get all processed documents
async function getProcessedDocuments() {
  await ensureStorageExists();
  
  const dirToUse = global.STORAGE_DIR || STORAGE_DIR;
  
  try {
    // Safely read directory
    const files = await safeFileOperation(
      () => readdir(dirToUse),
      []
    );
    
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} JSON files in ${dirToUse}`);
    
    const documents = [];
    for (const file of jsonFiles) {
      try {
        const content = await safeFileOperation(
          () => readFile(join(dirToUse, file), 'utf-8'),
          '{}'
        );
        
        const data = JSON.parse(content);
        if (data.metadata) {
          documents.push(data.metadata);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError);
        // Continue with other files
      }
    }
    
    return documents;
  } catch (error) {
    console.error('Error getting processed documents:', error);
    return []; // Return empty array if there's an error
  }
}

// API route handlers
export async function GET() {
  try {
    const documents = await getProcessedDocuments();
    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API-POST] Starting file upload process...');
    console.log(`[API-POST] Current working directory: ${process.cwd()}`);
    console.log(`[API-POST] Request method: ${request.method}, URL: ${request.url}`);
    console.log(`[API-POST] Request headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()))}`);
    
    // Check if we're in a Netlify environment
    const isNetlify = process.env.NETLIFY === 'true' || 
                      process.env.NETLIFY_DEV === 'true' || 
                      process.env.CONTEXT === 'production' || 
                      process.env.CONTEXT === 'deploy-preview' ||
                      process.env.CONTEXT === 'branch-deploy' ||
                      process.env.SITE_NAME?.includes('netlify');
    
    console.log(`[API-POST] Environment detection: Netlify = ${isNetlify ? 'Yes' : 'No'}, NODE_ENV = ${process.env.NODE_ENV}`);
    console.log(`[API-POST] Environment variables: ${JSON.stringify({
      NETLIFY: process.env.NETLIFY,
      NETLIFY_DEV: process.env.NETLIFY_DEV,
      CONTEXT: process.env.CONTEXT,
      SITE_NAME: process.env.SITE_NAME,
      NODE_ENV: process.env.NODE_ENV
    })}`);
    
    // Parse the form data
    console.log('[API-POST] Parsing form data...');
    const formData = await request.formData();
    console.log(`[API-POST] Form data keys: ${Array.from(formData.keys()).join(', ')}`);
    
    const file = formData.get('file') as File;
    const category = (formData.get('category') as string) || 'general';
    
    console.log(`[API-POST] Category: ${category}`);
    
    if (!file) {
      console.log('[API-POST] No file provided in the request');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log(`[API-POST] File details - name: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    
    // Validate file type
    const fileExtension = extname(file.name).toLowerCase();
    console.log(`[API-POST] File extension: ${fileExtension}`);
    
    if (fileExtension !== '.txt' && fileExtension !== '.pdf') {
      console.log(`[API-POST] Invalid file type: ${fileExtension}`);
      return NextResponse.json(
        { error: 'Only .txt and .pdf files are supported' },
        { status: 400 }
      );
    }
    
    try {
      // Initialize storage first
      console.log('[API-POST] Initializing storage before saving file...');
      await initializeStorage();
      console.log('[API-POST] Storage initialization completed');
      console.log(`[API-POST] Global storage dir after init: ${global.STORAGE_DIR || 'not set'}`);
      
      // Save the file
      console.log('[API-POST] Starting file save process...');
      const filePath = await saveFile(file, category);
      console.log(`[API-POST] File saved successfully to: ${filePath}`);
      
      // Process the document
      console.log('[API-POST] Starting document processing...');
      const documentMetadata = await processDocument(filePath, category);
      console.log(`[API-POST] Document processed successfully: ${documentMetadata.id}`);
      
      console.log('[API-POST] Returning success response');
      return NextResponse.json({
        message: 'Document processed successfully',
        document: documentMetadata,
        environment: {
          isNetlify,
          nodeEnv: process.env.NODE_ENV,
          storagePath: global.STORAGE_DIR || STORAGE_DIR,
          cwd: process.cwd(),
          tmpAccess: await checkTmpAccess()
        }
      });
    } catch (processingError) {
      console.error('[API-POST] Error during document processing:', processingError);
      console.error(`[API-POST] Processing error details: ${processingError instanceof Error ? processingError.message : String(processingError)}`);
      console.error(`[API-POST] Processing error stack: ${processingError instanceof Error ? processingError.stack : 'No stack trace'}`);
      
      // Return a more specific error message
      console.log('[API-POST] Returning error response for processing error');
      return NextResponse.json(
        { 
          error: 'Document processing failed',
          details: processingError instanceof Error ? processingError.message : String(processingError),
          stack: processingError instanceof Error ? processingError.stack : undefined,
          environment: {
            isNetlify,
            nodeEnv: process.env.NODE_ENV,
            storagePath: global.STORAGE_DIR || STORAGE_DIR,
            cwd: process.cwd(),
            tmpAccess: await checkTmpAccess()
          }
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[API-POST] Unhandled error in POST handler:', error);
    console.error(`[API-POST] Error details: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[API-POST] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    
    console.log('[API-POST] Returning error response for unhandled error');
    return NextResponse.json(
      { 
        error: 'Request processing failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          cwd: process.cwd()
        }
      },
      { status: 500 }
    );
  }
}

// Helper function to check if /tmp is accessible
async function checkTmpAccess(): Promise<{writable: boolean, error?: string}> {
  try {
    console.log('[TMP-CHECK] Testing /tmp directory access...');
    const testPath = '/tmp/test-write-access.txt';
    
    // Try to write to /tmp
    await writeFile(testPath, 'Test write access');
    console.log('[TMP-CHECK] Successfully wrote to /tmp');
    
    // Try to read from /tmp
    const content = await readFile(testPath, 'utf-8');
    console.log(`[TMP-CHECK] Successfully read from /tmp, content length: ${content.length}`);
    
    // Clean up
    await writeFile(testPath, '');
    console.log('[TMP-CHECK] Cleaned up test file');
    
    return { writable: true };
  } catch (error) {
    console.error('[TMP-CHECK] Error accessing /tmp:', error);
    console.error(`[TMP-CHECK] Error details: ${error instanceof Error ? error.message : String(error)}`);
    return { 
      writable: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}