# Netlify Deployment Guide

This guide will help you properly deploy this Next.js application to Netlify.

## Prerequisites

1. A Netlify account
2. Your OpenAI API key
3. Your HeyGen API key (if using avatar features)

## Deployment Steps

### 1. Set up Environment Variables in Netlify

Before deploying, you need to set up the following environment variables in Netlify:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Add the following environment variables:

   - `OPENAI_API_KEY`: Your OpenAI API key
   - `HEYGEN_API_KEY`: Your HeyGen API key
   - `NEXT_PUBLIC_BASE_API_URL`: The base URL for HeyGen API (default is https://api.heygen.com)

### 2. Deploy to Netlify

#### Option 1: Deploy via Netlify UI

1. Go to [Netlify](https://app.netlify.com/)
2. Click "Add new site" > "Import an existing project"
3. Connect to your Git provider and select your repository
4. Configure build settings:
   - Build command: `next build`
   - Publish directory: `.next`
5. Click "Deploy site"

#### Option 2: Deploy via Netlify CLI

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Login to Netlify: `netlify login`
3. Initialize your site: `netlify init`
4. Deploy your site: `netlify deploy --prod`

### 3. Troubleshooting Common Issues

If you encounter a 500 Internal Server Error after deployment, check the following:

1. **Environment Variables**: Ensure all required environment variables are set in Netlify.
2. **Build Logs**: Check Netlify build logs for any errors during the build process.
3. **Function Logs**: Check Netlify function logs for runtime errors.

To view function logs:
1. Go to your Netlify site dashboard
2. Navigate to **Functions** > Click on the function name
3. View the logs to identify any errors

### 4. Additional Configuration

If you need to modify the Netlify configuration, you can edit the `netlify.toml` file in the root of your project.

## Important Notes

- The application uses file system operations for RAG functionality. In Netlify's serverless environment, these operations are limited to the `/tmp` directory and are ephemeral.
- For production use with RAG, consider using a database or vector store service instead of the file system.

## PDF Upload Functionality

The PDF upload functionality has been modified to work in Netlify's serverless environment. Here are some important considerations:

1. **Temporary Storage**: Files uploaded in the serverless environment are stored in the `/tmp` directory, which is ephemeral. This means that uploaded files and their vectorized data will be lost when the function instance is recycled.

2. **File Size Limits**: Netlify has a 10MB limit for function payloads. Large PDF files may exceed this limit.

3. **Function Timeout**: The default function timeout is 10 seconds, which may not be enough for processing large PDFs. We've increased this to 30 seconds in the `netlify.toml` configuration.

4. **Alternatives for Production**:
   - For production use, consider using a cloud storage service like AWS S3 or Google Cloud Storage for file uploads
   - Use a vector database like Pinecone, Weaviate, or Qdrant for storing and querying embeddings
   - Implement a background job system for processing large files asynchronously