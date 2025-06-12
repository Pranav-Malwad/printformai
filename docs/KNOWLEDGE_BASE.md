# Knowledge Base Management Guide

This guide explains how to add new user manuals and documentation to the AI assistant's knowledge base.

## Supported File Formats

The system supports the following file formats:

- **Text Files (.txt)**: Plain text files, optionally with Markdown formatting
- **PDF Files (.pdf)**: PDF documents will be automatically converted to text

## Adding New Documents

There are three ways to add new documents to the knowledge base:

### 1. Using the Web Interface (Recommended)

1. Navigate to `/admin/upload` in your browser
2. Select the document category from the dropdown
3. Upload your PDF or TXT file
4. Click "Upload & Process"
5. Wait for the confirmation message

### 2. Using the PDF Processing Script

For batch processing multiple PDF files:

1. Place your PDF files in the `/storage/pdf-uploads` directory
2. Open a terminal and navigate to the project root
3. Run the PDF processing script:
   ```
   node scripts/process-pdf-docs.js
   ```
4. The script will process all PDF files in the directory and add them to the knowledge base

### 3. Manual Addition (Advanced)

For direct addition of text files:

1. Create a text file with your content (use Markdown formatting for better structure)
2. Save the file in the `/storage/documents` directory with a descriptive name
3. Run the vectorization script:
   ```
   node scripts/process-mcloud-doc.js
   ```
   (You may need to modify this script to target your specific file)

## Document Structure Best Practices

For optimal results, structure your documents as follows:

1. **Use Clear Headings**: Start sections with Markdown headings (`#`, `##`, `###`)
2. **Keep Paragraphs Focused**: Each paragraph should cover a single topic
3. **Use Lists for Steps**: Use numbered or bulleted lists for procedures
4. **Include Examples**: Provide concrete examples where appropriate
5. **Define Terms**: Include definitions for technical terms
6. **Organize Hierarchically**: Structure content from general to specific

## Verifying Document Addition

To verify that your document has been added to the knowledge base:

1. Check the `/storage/documents` directory for JSON files containing your document's embeddings
2. Test the AI assistant by asking questions related to the content you added
3. If the AI doesn't seem to use your new content, try resetting the conversation

## Troubleshooting

If you encounter issues:

- **PDF Extraction Fails**: Some PDFs with complex formatting or scanned content may not extract properly. Try converting to a simpler PDF format or manually create a text version.
- **Content Not Being Used**: The AI might not retrieve your content if the questions aren't closely related to the content. Try being more specific in your questions.
- **Processing Errors**: Check the console output for specific error messages when running the processing scripts.

## Maintenance

Periodically review and update your knowledge base:

1. Remove outdated documents by deleting their corresponding JSON files
2. Update documents by replacing the original files and reprocessing them
3. Monitor the AI's responses to identify gaps in the knowledge base