import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

// Helper function to safely perform file operations
const safeFileOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error("File operation failed:", error);
    return fallback;
  }
};

/**
 * Extract text from a PDF file
 * @param filePath Path to the PDF file
 * @returns Extracted text content
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    console.log(`[PDF-EXTRACT] Starting extraction from PDF: ${filePath}`);
    console.log(`[PDF-EXTRACT] Current working directory: ${process.cwd()}`);
    console.log(`[PDF-EXTRACT] Environment: NODE_ENV=${process.env.NODE_ENV}, NETLIFY=${process.env.NETLIFY || 'not set'}`);
    console.log(`[PDF-EXTRACT] Global storage dir: ${global.STORAGE_DIR || 'not set'}`);
    
    // Verify the file exists first
    try {
      console.log(`[PDF-EXTRACT] Checking if file exists: ${filePath}`);
      const fileStats = await fs.stat(filePath);
      console.log(`[PDF-EXTRACT] PDF file exists, size: ${fileStats.size} bytes, isFile: ${fileStats.isFile()}, mode: ${fileStats.mode.toString(8)}`);
      
      if (fileStats.size === 0) {
        console.error('[PDF-EXTRACT] PDF file exists but is empty (0 bytes)');
        return 'PDF file is empty (0 bytes).';
      }
    } catch (statError) {
      console.error(`[PDF-EXTRACT] PDF file does not exist or is not accessible: ${filePath}`, statError);
      console.error(`[PDF-EXTRACT] Error details: ${statError instanceof Error ? statError.message : String(statError)}`);
      console.error(`[PDF-EXTRACT] Error stack: ${statError instanceof Error ? statError.stack : 'No stack trace'}`);
      return `PDF file does not exist or is not accessible: ${statError instanceof Error ? statError.message : String(statError)}`;
    }
    
    // Read the PDF file with safe operation
    console.log(`[PDF-EXTRACT] Attempting to read file: ${filePath}`);
    const dataBuffer = await safeFileOperation(
      () => fs.readFile(filePath),
      Buffer.from([]) // Empty buffer as fallback
    );
    
    console.log(`[PDF-EXTRACT] PDF file read attempt completed, buffer size: ${dataBuffer.length} bytes`);
    console.log(`[PDF-EXTRACT] Buffer valid: ${dataBuffer && dataBuffer.length > 0 ? 'Yes' : 'No'}`);
    
    // Check if the buffer is valid
    if (!dataBuffer || dataBuffer.length === 0) {
      console.error('[PDF-EXTRACT] PDF file is empty or could not be read');
      return 'PDF file could not be read. The file may be empty or inaccessible.';
    }
    
    try {
      // Parse the PDF with a timeout
      console.log('[PDF-EXTRACT] Starting PDF parsing...');
      const data = await pdfParse(dataBuffer, {
        // Add options if needed
        max: 0, // 0 = no limit
      });
      
      console.log(`[PDF-EXTRACT] PDF parsed successfully, extracted ${data.text.length} characters`);
      console.log(`[PDF-EXTRACT] PDF info - Version: ${data.info?.PDFFormatVersion || 'unknown'}, Pages: ${data.numpages || 0}`);
      
      // Return the text content
      return data.text || 'No text content found in PDF';
    } catch (parseError) {
      console.error('[PDF-EXTRACT] PDF parsing error:', parseError);
      console.error(`[PDF-EXTRACT] Parse error details: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      console.error(`[PDF-EXTRACT] Parse error stack: ${parseError instanceof Error ? parseError.stack : 'No stack trace'}`);
      // Fallback: Return a message that can be processed
      return `[PDF EXTRACTION FAILED: ${parseError instanceof Error ? parseError.message : String(parseError)}]`;
    }
  } catch (error) {
    console.error(`[PDF-EXTRACT] Unhandled error extracting text from PDF ${filePath}:`, error);
    console.error(`[PDF-EXTRACT] Error details: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[PDF-EXTRACT] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    // Return a fallback message instead of throwing
    return `Error extracting text from PDF: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Convert a PDF file to a text file
 * @param pdfPath Path to the PDF file
 * @param outputDir Directory to save the text file (optional)
 * @returns Path to the created text file
 */
export async function convertPDFToText(pdfPath: string, outputDir?: string): Promise<string> {
  try {
    // Extract text from the PDF
    const text = await extractTextFromPDF(pdfPath);
    
    // Determine the output directory
    const targetDir = outputDir || path.dirname(pdfPath);
    
    // Create the output file path
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPath = path.join(targetDir, `${baseName}.txt`);
    
    // Write the text to a file
    await fs.writeFile(outputPath, text, 'utf-8');
    
    return outputPath;
  } catch (error) {
    console.error(`Error converting PDF to text ${pdfPath}:`, error);
    throw new Error(`Failed to convert PDF to text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Process a directory of PDF files and convert them to text
 * @param inputDir Directory containing PDF files
 * @param outputDir Directory to save text files (optional)
 * @returns Array of paths to created text files
 */
export async function processPDFDirectory(inputDir: string, outputDir?: string): Promise<string[]> {
  try {
    // Get all files in the directory
    const files = await fs.readdir(inputDir);
    
    // Filter for PDF files
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    // Create the output directory if it doesn't exist
    const targetDir = outputDir || inputDir;
    await fs.mkdir(targetDir, { recursive: true });
    
    // Process each PDF file
    const outputPaths: string[] = [];
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(inputDir, pdfFile);
      const outputPath = await convertPDFToText(pdfPath, targetDir);
      outputPaths.push(outputPath);
    }
    
    return outputPaths;
  } catch (error) {
    console.error(`Error processing PDF directory ${inputDir}:`, error);
    throw new Error(`Failed to process PDF directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}