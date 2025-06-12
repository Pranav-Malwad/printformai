const { execSync } = require('child_process');
const { join } = require('path');
const { readdirSync, existsSync } = require('fs');

// Path to the functions directory
const FUNCTIONS_DIR = join(__dirname, '..', 'netlify', 'functions');

// Get all directories in the functions directory
const functionDirs = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

console.log(`Found ${functionDirs.length} function directories: ${functionDirs.join(', ')}`);

// Install dependencies for each function
functionDirs.forEach(functionDir => {
  const packageJsonPath = join(FUNCTIONS_DIR, functionDir, 'package.json');
  
  if (existsSync(packageJsonPath)) {
    console.log(`Installing dependencies for ${functionDir}...`);
    try {
      execSync('npm install', { 
        cwd: join(FUNCTIONS_DIR, functionDir),
        stdio: 'inherit'
      });
      console.log(`Successfully installed dependencies for ${functionDir}`);
    } catch (error) {
      console.error(`Error installing dependencies for ${functionDir}:`, error);
    }
  } else {
    console.log(`No package.json found for ${functionDir}, skipping...`);
  }
});

console.log('Finished installing dependencies for all functions');