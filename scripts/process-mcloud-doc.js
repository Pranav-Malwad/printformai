// Script to process the MCloud document and create embeddings

const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Get the OpenAI API key from the .env.local file
async function getOpenAIKey() {
  try {
    const envContent = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf-8');
    const match = envContent.match(/OPENAI_API_KEY=([^\n]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    throw new Error('OPENAI_API_KEY not found in .env.local');
  } catch (error) {
    console.error('Error reading API key:', error);
    throw error;
  }
}

// Initialize OpenAI client
let openai;

// Define the storage directory for documents
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents');
const MCLOUD_DOC_PATH = path.join(STORAGE_DIR, 'mcloud_info.txt');

// Split text into chunks
function splitIntoChunks(text, chunkSize = 1000) {
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
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  
  return response.data[0].embedding;
}

// Process document and create embeddings
async function processDocument(filePath, category) {
  console.log(`Processing document: ${filePath}`);
  
  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Split content into chunks
  const chunks = splitIntoChunks(content, 1000);
  console.log(`Split into ${chunks.length} chunks`);
  
  // Create a namespace for this document
  const namespace = `${category}_${uuidv4()}`;
  
  // Process each chunk and create embeddings
  const processedChunks = [];
  for (let index = 0; index < chunks.length; index++) {
    console.log(`Processing chunk ${index + 1}/${chunks.length}`);
    const chunk = chunks[index];
    const embedding = await createEmbedding(chunk);
    
    // Save the chunk with its embedding
    const chunkData = {
      id: `chunk_${index}`,
      content: chunk,
      embedding,
      metadata: {
        source: path.basename(filePath),
        chunk: index,
        category,
      }
    };
    
    processedChunks.push(chunkData);
  }
  
  // Save document metadata
  const documentMetadata = {
    id: uuidv4(),
    fileName: path.basename(filePath),
    namespace,
    chunks: chunks.length,
    createdAt: new Date().toISOString(),
    filePath,
  };
  
  // Save to a JSON file
  const outputPath = path.join(STORAGE_DIR, `${namespace}.json`);
  await fs.writeFile(
    outputPath,
    JSON.stringify({
      metadata: documentMetadata,
      chunks: processedChunks,
    })
  );
  
  console.log(`Document processed and saved to: ${outputPath}`);
  return documentMetadata;
}

// Main function
async function main() {
  try {
    // Get the OpenAI API key
    const apiKey = await getOpenAIKey();
    
    // Initialize OpenAI client
    openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Process the MCloud document
    await processDocument(MCLOUD_DOC_PATH, 'mcloud');
    console.log('MCloud document processed successfully!');
  } catch (error) {
    console.error('Error processing document:', error);
  }
}

// Run the script
main();