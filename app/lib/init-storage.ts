import { mkdir, stat, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import createLogger from './logger';

// Create a logger for this module
const logger = createLogger('STORAGE-INIT');

// Declare global namespace to add STORAGE_DIR property
declare global {
  var STORAGE_DIR: string;
}

// Helper function to safely perform file operations
const safeFileOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    logger.error("File operation failed:", error);
    return fallback;
  }
};

// Define the storage directory for documents
let STORAGE_DIR = join(process.cwd(), 'storage', 'documents');

// Ensure storage directory exists
export async function initializeStorage() {
  try {
    logger.info('Starting storage initialization');
    logger.info(`Current working directory: ${process.cwd()}`);
    logger.info(`Environment variables: NODE_ENV=${process.env.NODE_ENV}`);
    logger.info(`Netlify env: NETLIFY=${process.env.NETLIFY || 'not set'}, CONTEXT=${process.env.CONTEXT || 'not set'}`);
    logger.info(`Initial STORAGE_DIR value: ${STORAGE_DIR}`);
    
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    logger.info(`Browser environment detected: ${isBrowser}`);
    
    // Skip file operations in browser environment
    if (isBrowser) {
      logger.info('Running in browser environment, skipping file operations');
      return;
    }
    
    // In Netlify serverless functions, we need to use /tmp directory for file operations
    // Check for Netlify environment in multiple ways
    const isNetlify = process.env.NETLIFY === 'true' || 
                      process.env.NETLIFY_DEV === 'true' || 
                      process.env.CONTEXT === 'production' || 
                      process.env.CONTEXT === 'deploy-preview' ||
                      process.env.CONTEXT === 'branch-deploy' ||
                      process.env.SITE_NAME?.includes('netlify');
    
    // Always assume serverless in production to be safe
    const isProduction = process.env.NODE_ENV === 'production';
    const isServerless = isNetlify || isProduction;
    
    logger.info(`Environment detection: isNetlify=${isNetlify}, isProduction=${isProduction}, isServerless=${isServerless}`);
    
    if (isServerless) {
      logger.info('Running in serverless environment, using /tmp directory');
      // In serverless, use the /tmp directory which is writable
      STORAGE_DIR = '/tmp/storage/documents';
      
      // Make this available globally
      global.STORAGE_DIR = STORAGE_DIR;
      logger.info(`Set global.STORAGE_DIR to: ${global.STORAGE_DIR}`);
      
      // For Netlify specifically, ensure /tmp exists and is writable
      if (isNetlify) {
        try {
          logger.info('Testing /tmp directory access on Netlify...');
          const testPath = '/tmp/netlify-test.txt';
          await writeFile(testPath, 'Testing Netlify /tmp access');
          const content = await readFile(testPath, 'utf-8');
          logger.info(`Successfully verified /tmp access on Netlify, read ${content.length} bytes`);
          await unlink(testPath).catch((e: Error) => logger.warn('Cleanup error (non-critical):', e));
        } catch (tmpError) {
          logger.error('Error accessing /tmp on Netlify:', tmpError);
          logger.error(`This may indicate a permissions issue with the /tmp directory`);
        }
      }
    } else {
      logger.info('Running in local environment, using local storage directory');
      // Make sure the local storage directory is available globally
      global.STORAGE_DIR = STORAGE_DIR;
      logger.info(`Set global.STORAGE_DIR to: ${global.STORAGE_DIR}`);
    }
    
    logger.info(`Checking if storage directory exists: ${STORAGE_DIR}`);
    
    await safeFileOperation(
      async () => {
        try {
          const stats = await stat(STORAGE_DIR);
          logger.info(`Storage directory already exists, isDirectory: ${stats.isDirectory()}, mode: ${stats.mode.toString(8)}`);
        } catch (statError) {
          logger.info(`Storage directory does not exist, creating: ${STORAGE_DIR}`);
          logger.info(`Stat error: ${statError instanceof Error ? statError.message : String(statError)}`);
          
          try {
            await mkdir(STORAGE_DIR, { recursive: true });
            
            // Verify directory was created
            const verifyStats = await stat(STORAGE_DIR);
            logger.info(`Storage directory created successfully, isDirectory: ${verifyStats.isDirectory()}, mode: ${verifyStats.mode.toString(8)}`);
          } catch (mkdirError) {
            logger.error(`Failed to create storage directory: ${STORAGE_DIR}`);
            logger.error(`Mkdir error: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
            logger.error(`Mkdir error stack: ${mkdirError instanceof Error ? mkdirError.stack : 'No stack trace'}`);
            throw mkdirError; // Rethrow to handle at higher level
          }
        }
      },
      undefined
    );
    
    // Test write access to the directory
    try {
      const testFilePath = join(STORAGE_DIR, `test-write-${Date.now()}.txt`);
      logger.info(`Testing write access with test file: ${testFilePath}`);
      
      await safeFileOperation(
        async () => {
          const fs = require('fs/promises');
          await fs.writeFile(testFilePath, 'Test write access');
          logger.info(`Successfully wrote test file: ${testFilePath}`);
          
          // Try to read it back
          const content = await fs.readFile(testFilePath, 'utf-8');
          logger.info(`Successfully read test file, content length: ${content.length}`);
          
          // Clean up
          await fs.unlink(testFilePath).catch((e: Error) => logger.warn('Cleanup error (non-critical):', e));
        },
        undefined
      );
    } catch (testError) {
      logger.error(`Write access test failed: ${testError instanceof Error ? testError.message : String(testError)}`);
      // Don't throw, just log the error
    }
    
    logger.info('Storage initialization completed successfully');
  } catch (error) {
    logger.error('Error initializing storage:', error);
    logger.error(`Error details: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    // In serverless environments, we might not have write access
    // Just log the error and continue
  }
}

// Export the storage directory
export { STORAGE_DIR };

// Call this function during app initialization
export default initializeStorage;