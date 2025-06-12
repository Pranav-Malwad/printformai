# Printform Support Agent with RAG and Command Prompting

This document provides instructions on how to use the Retrieval-Augmented Generation (RAG) system and command prompting features for the Printform Support Agent.

## Overview

The Printform Support Agent is designed to assist employees and new users of Printform Manufacturing Company by providing information about:

- Manufacturing services (CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing)
- Manufacturing processes and capabilities
- Materials, tolerances, and design guidelines
- Order processes and production timelines
- Troubleshooting common issues

The agent uses two key technologies:
1. **RAG (Retrieval-Augmented Generation)**: Enhances responses with information from company documents
2. **Command Prompting**: Provides structured commands for specific information needs

## Using RAG (Knowledge Base)

The RAG system allows the agent to retrieve and use information from company documents to provide more accurate and detailed responses.

### Adding Documents to the Knowledge Base

1. Navigate to the Knowledge Base page (`/knowledge-base`)
2. Click on "Upload Document"
3. Enter a category (e.g., "manufacturing", "materials", "processes")
4. Select a document file (PDF, TXT, or DOCX)
5. Click "Upload Document"

The system will process the document, split it into chunks, and create embeddings for retrieval.

### Querying the Knowledge Base

You can query the knowledge base in two ways:

1. **Through the Avatar Interface**: Simply ask questions naturally, and the RAG system will automatically retrieve relevant information to enhance the response.

2. **Through the Knowledge Base Page**: 
   - Navigate to the Knowledge Base page
   - Enter your question in the "Ask a Question" field
   - Click "Ask Question"
   - View the answer and the sources used

## Using Command Prompting

Command prompting provides a structured way to get specific information from the agent. Commands start with a forward slash (`/`) followed by the command name and parameters.

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/material` | Look up information about a specific material | `/material name=aluminum` |
| `/process` | Check details about a manufacturing process | `/process name=cnc` |
| `/time` | Estimate production time | `/time process=injection quantity=1000 complexity=medium` |
| `/cost` | Calculate estimated cost | `/cost process=cnc quantity=10 material=steel` |
| `/troubleshoot` | Get troubleshooting steps for common issues | `/troubleshoot issue=warping` |
| `/explain` | Get detailed explanation of a process | `/explain process=injection molding` |
| `/compare` | Compare two manufacturing methods | `/compare method1=cnc method2=3dprinting` |
| `/resource` | Find resources about a specific topic | `/resource topic=design guidelines` |

### Command Parameters

Parameters are specified in `key=value` format, separated by spaces. For example:

```
/time process=cnc quantity=5 complexity=high
```

This command estimates the production time for 5 high-complexity parts using CNC machining.

## Setup Instructions

To set up the Printform Support Agent:

1. Ensure you have an OpenAI API key
2. Set the API key in your environment variables:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run the development server:
   ```
   npm run dev
   ```
5. Open your browser to `http://localhost:3000`

## Folder Structure

- `/app/api/knowledge`: API routes for the knowledge base
- `/app/lib/openai-assistant.ts`: OpenAI assistant implementation with RAG
- `/app/utils/commandPrompting.ts`: Command prompting utilities
- `/storage/documents`: Storage for knowledge base documents

## Customization

### Modifying Assistant Instructions

To modify the assistant's instructions, edit the `initialize` method in `/app/lib/openai-assistant.ts`.

### Adding New Commands

To add new commands:
1. Update the `CommandType` enum in `/app/utils/commandPrompting.ts`
2. Add a new case in the `parseCommand` function
3. Implement a new generator function for the command
4. Add the command to the help text in the UI

## Troubleshooting

- **API Key Issues**: Ensure your OpenAI API key is correctly set in the environment variables
- **Document Processing Errors**: Check that your documents are in a supported format (PDF, TXT, DOCX)
- **Command Not Recognized**: Verify the command syntax and parameters
- **RAG Not Working**: Ensure you have uploaded documents to the knowledge base

For additional help, contact the development team.