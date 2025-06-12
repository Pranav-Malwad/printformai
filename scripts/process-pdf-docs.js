// Script to process PDF documents and create embeddings

const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');

// Define the storage directory for documents
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents');
const PDF_DIR = path.join(process.cwd(), 'storage', 'pdf-uploads');

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

// Extract text from PDF
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error extracting text from PDF ${pdfPath}:`, error);
    throw error;
  }
}

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
async function createEmbedding(text, openai) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  
  return response.data[0].embedding;
}

// Process document and create embeddings
async function processDocument(filePath, category, openai) {
  console.log(`Processing document: ${filePath}`);
  
  // Determine file type and extract content
  const fileExtension = path.extname(filePath).toLowerCase();
  let content;
  
  if (fileExtension === '.pdf') {
    console.log('Extracting text from PDF...');
    content = await extractTextFromPDF(filePath);
  } else {
    content = await fs.readFile(filePath, 'utf-8');
  }
  
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
    const embedding = await createEmbedding(chunk, openai);
    
    // Save the chunk with its embedding
    const chunkData = {
      id: `chunk_${index}`,
      content: chunk,
      embedding,
      metadata: {
        source: path.basename(filePath),
        chunk: index,
        category,
        fileType: fileExtension.replace('.', '')
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
    fileType: fileExtension.replace('.', '')
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

// Ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Process all PDF files in a directory
async function processPDFDirectory(dirPath, category, openai) {
  try {
    const files = await fs.readdir(dirPath);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    console.log(`Found ${pdfFiles.length} PDF files in ${dirPath}`);
    
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(dirPath, pdfFile);
      await processDocument(pdfPath, category, openai);
    }
    
    console.log('All PDF files processed successfully!');
  } catch (error) {
    console.error('Error processing PDF directory:', error);
  }
}

// Main function
async function main() {
  try {
    // Ensure directories exist
    await ensureDirectoryExists(STORAGE_DIR);
    await ensureDirectoryExists(PDF_DIR);
    
    // Get the OpenAI API key
    const apiKey = await getOpenAIKey();
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Process all PDF files in the uploads directory
    await processPDFDirectory(PDF_DIR, 'manual', openai);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the script
main();