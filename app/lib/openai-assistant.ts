import OpenAI from "openai";
import { join } from 'path';
import { readdir, readFile } from 'fs/promises';

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

export class OpenAIAssistant {
  private client: OpenAI;
  private assistant: any;
  private thread: any;
  private useRAG: boolean;

  constructor(apiKey: string) {
    try {
      this.client = new OpenAI({ 
        apiKey, 
        dangerouslyAllowBrowser: true 
      });
      this.useRAG = true; // Enable RAG by default
      
      // Validate the client was created successfully
      if (!this.client) {
        throw new Error('Failed to initialize OpenAI client');
      }
      
      console.log('OpenAI client initialized successfully');
    } catch (error) {
      console.error('Error initializing OpenAI client:', error);
      throw new Error(`Failed to initialize OpenAI client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async initialize(
    instructions: string = `You are a support assistant for Printform Manufacturing Company. Help employees and new users by:
- Answering questions about Printform's manufacturing services (CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing)
- Explaining manufacturing processes and capabilities
- Providing information about materials, tolerances, and design guidelines
- Assisting with order processes and production timelines
- Troubleshooting common issues with manufacturing processes

Be professional, accurate, and helpful. If you don't know the answer, say so clearly rather than making up information.`,
    existingThreadId: string | null = null
  ) {
    try {
      console.log("Creating OpenAI assistant");
      // Create an assistant
      this.assistant = await this.client.beta.assistants.create({
        name: "Printform Support Assistant",
        instructions,
        tools: [],
        model: "gpt-4-turbo-preview",
      });

      console.log("Creating or retrieving thread");
      // Create a new thread or use existing one
      if (existingThreadId) {
        try {
          // Try to retrieve the existing thread
          this.thread = await this.client.beta.threads.retrieve(existingThreadId);
          console.log("Retrieved existing thread:", existingThreadId);
        } catch (threadError) {
          console.warn("Could not retrieve thread, creating new one:", threadError);
          this.thread = await this.client.beta.threads.create();
        }
      } else {
        // Create a new thread
        this.thread = await this.client.beta.threads.create();
      }
      
      console.log("Assistant initialized successfully with thread ID:", this.thread.id);
    } catch (error) {
      console.error("Error initializing OpenAI assistant:", error);
      throw new Error(`Failed to initialize OpenAI assistant: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Create embedding for query
  private async createEmbedding(text: string) {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    
    return response.data[0].embedding;
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
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
  private async findRelevantChunks(queryEmbedding: number[], limit: number = 5) {
    try {
      // Safely read directory, return empty array if it fails
      const files = await safeFileOperation(
        () => readdir(STORAGE_DIR),
        []
      );
      
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      let allChunks: any[] = [];
      
      // Load all chunks from all documents
      for (const file of jsonFiles) {
        try {
          const content = await safeFileOperation(
            () => readFile(join(STORAGE_DIR, file), 'utf-8'),
            '{}'
          );
          
          const data = JSON.parse(content);
          if (data.chunks && Array.isArray(data.chunks)) {
            allChunks = allChunks.concat(data.chunks);
          }
        } catch (fileError) {
          console.error(`Error processing file ${file}:`, fileError);
          // Continue with other files
        }
      }
      
      if (allChunks.length === 0) {
        return [];
      }
      
      // Calculate similarity for each chunk
      const chunksWithSimilarity = allChunks.map(chunk => ({
        ...chunk,
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      }));
      
      // Sort by similarity and take the top results
      return chunksWithSimilarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(chunk => ({
          content: chunk.content,
          metadata: chunk.metadata || {},
          similarity: chunk.similarity,
        }));
    } catch (error) {
      console.error("Error finding relevant chunks:", error);
      return []; // Return empty array if there's an error
    }
  }

  // Helper method to implement retry logic
  private async withRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message || error);
        
        // Don't wait on the last attempt
        if (attempt < maxRetries) {
          // Exponential backoff
          const backoffDelay = delay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    throw lastError;
  }

  async getResponse(userMessage: string): Promise<{ answer: string, threadId: string }> {
    // Validate assistant and thread are initialized
    if (!this.assistant) {
      console.error("Assistant not initialized");
      throw new Error("Assistant not initialized. Call initialize() first.");
    }
    
    if (!this.thread) {
      console.error("Thread not initialized");
      throw new Error("Thread not initialized. Call initialize() first.");
    }
    
    // Validate user message
    if (!userMessage || typeof userMessage !== 'string') {
      console.error("Invalid user message:", userMessage);
      throw new Error("Invalid user message. Message must be a non-empty string.");
    }
    
    console.log("Starting getResponse with message length:", userMessage.length);
    console.log("Thread ID:", this.thread.id);

    try {
      console.log("Processing with RAG if available");
      
      let enhancedMessage = userMessage;
      
      // If RAG is enabled, try to enhance the message with relevant context
      if (this.useRAG) {
        try {
          console.log("RAG is enabled, attempting to find relevant context");
          
          // Try to read static documents first as a fallback
          try {
            // Read static documents from storage/documents directory
            const staticDocs = ['printform_info.txt', 'mcloud_info.txt'];
            let staticContext = '';
            
            for (const docName of staticDocs) {
              try {
                const docPath = join(STORAGE_DIR, docName);
                const content = await safeFileOperation(
                  () => readFile(docPath, 'utf-8'),
                  ''
                );
                
                if (content) {
                  staticContext += content + '\n\n';
                }
              } catch (docError) {
                console.warn(`Could not read static document ${docName}:`, docError);
                // Continue with other documents
              }
            }
            
            if (staticContext) {
              console.log("Using static context documents");
              // Enhance the message with static context
              enhancedMessage = `
I have a question: ${userMessage}

Here is some relevant information that might help you answer:
${staticContext}

Please use this information to provide an accurate and helpful response to my question.`;
              
              // Skip the more complex embedding-based RAG
              console.log("Using static context instead of embedding-based RAG");
              // Continue with the rest of the function instead of returning early
            }
          } catch (staticDocError) {
            console.warn("Error reading static documents:", staticDocError);
            // Continue with embedding-based RAG
          }
          
          // Only try embedding-based RAG if static documents failed
          console.log("Attempting embedding-based RAG");
          
          // Create embedding for the query with retry
          const queryEmbedding = await this.withRetry(() => 
            this.createEmbedding(userMessage)
          );
          
          // Find relevant chunks
          const relevantChunks = await this.findRelevantChunks(queryEmbedding);
          
          if (relevantChunks.length > 0) {
            console.log(`Found ${relevantChunks.length} relevant chunks`);
            // Prepare context from relevant chunks
            const context = relevantChunks
              .map(chunk => chunk.content)
              .join('\n\n');
            
            // Enhance the message with context
            enhancedMessage = `
I have a question: ${userMessage}

Here is some relevant information that might help you answer:
${context}

Please use this information to provide an accurate and helpful response to my question.`;
          } else {
            console.log("No relevant chunks found");
          }
        } catch (ragError) {
          console.error("Error in RAG processing:", ragError);
          console.error("RAG error stack:", ragError instanceof Error ? ragError.stack : '');
          // Continue with original message if RAG fails
          console.log("Continuing with original message due to RAG error");
        }
      } else {
        console.log("RAG is disabled");
      }

      console.log("Adding user message to thread");
      // Add user message to thread with retry
      await this.withRetry(() => 
        this.client.beta.threads.messages.create(this.thread.id, {
          role: "user",
          content: enhancedMessage,
        })
      );

      console.log("Creating and running assistant");
      
      // Create a run with a shorter timeout (20 seconds) for Netlify compatibility
      const run = await this.withRetry(async () => {
        // Set a timeout for the OpenAI API call (20 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("OpenAI API request timed out after 20 seconds")), 20000);
        });
        
        try {
          // Create the run
          const runOperation = this.client.beta.threads.runs.create(
            this.thread.id,
            { assistant_id: this.assistant.id }
          );
          
          // Race the API call against the timeout
          return await Promise.race([runOperation, timeoutPromise]);
        } catch (error) {
          console.error("Error creating run:", error);
          throw error;
        }
      });
      
      console.log(`Run created with ID: ${run.id}, status: ${run.status}`);
      
      // Poll for completion with timeout and retry - reduced polling for Netlify
      const completedRun = await this.withRetry(async () => {
        let currentRun = run;
        let attempts = 0;
        const maxAttempts = 10; // Reduced from 30 to avoid timeouts
        
        while (
          currentRun.status !== "completed" && 
          currentRun.status !== "failed" && 
          currentRun.status !== "cancelled" && 
          attempts < maxAttempts
        ) {
          // Wait between polling attempts (increasing delay)
          const delay = Math.min(500 * Math.pow(1.3, attempts), 2000); // Reduced delays
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Get the updated run status
          currentRun = await this.client.beta.threads.runs.retrieve(
            this.thread.id,
            currentRun.id
          );
          
          console.log(`Run status (attempt ${attempts+1}/${maxAttempts}): ${currentRun.status}`);
          attempts++;
        }
        
        if (currentRun.status !== "completed") {
          throw new Error(`Run did not complete successfully. Final status: ${currentRun.status}`);
        }
        
        return currentRun;
      });

      if (completedRun.status === "completed") {
        console.log("Run completed, fetching messages");
        // Get the assistant's response with retry
        const messages = await this.withRetry(() => 
          this.client.beta.threads.messages.list(this.thread.id)
        );

        // Get the latest assistant message
        const lastMessage = messages.data.filter(
          (msg) => msg.role === "assistant"
        )[0];

        if (lastMessage && lastMessage.content[0].type === "text") {
          return {
            answer: lastMessage.content[0].text.value,
            threadId: this.thread.id
          };
        } else {
          console.error("No valid message content found in the response");
          return {
            answer: "I received your message but couldn't generate a proper response. Please try again.",
            threadId: this.thread.id
          };
        }
      } else {
        console.error("Run not completed, status:", completedRun.status);
        return {
          answer: `Sorry, I couldn't complete processing your request. Status: ${completedRun.status}`,
          threadId: this.thread.id
        };
      }
    } catch (error) {
      console.error("Error in OpenAI assistant getResponse:", error);
      
      // Provide a more user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes("timed out")) {
          throw new Error("The AI service is taking too long to respond. Please try again with a simpler question.");
        } else {
          throw error; // Re-throw to be handled by the API route
        }
      }
      
      throw error;
    }
  }
  
  // Toggle RAG functionality
  setUseRAG(useRAG: boolean): void {
    this.useRAG = useRAG;
  }
}