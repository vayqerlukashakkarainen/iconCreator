const fs = require('fs').promises;
const path = require('path');

async function buildStatic() {
  console.log('Building static site...');
  
  // Create dist directory
  await fs.mkdir('dist', { recursive: true });
  
  // Copy public files to dist
  const publicFiles = await fs.readdir('public');
  for (const file of publicFiles) {
    const srcPath = path.join('public', file);
    const destPath = path.join('dist', file);
    await fs.copyFile(srcPath, destPath);
    console.log(`Copied ${file}`);
  }
  
  // Copy CNAME file if it exists
  try {
    await fs.copyFile('CNAME', 'dist/CNAME');
    console.log('Copied CNAME file');
  } catch (error) {
    console.log('No CNAME file found, skipping...');
  }
  
  // Create a README for the deployment
  const readme = `# Icon Creator - Client-Side Static Version

This is a fully client-side icon creator that converts images to various app icon formats.

## Features
- 100% client-side processing (no server required)
- Upload images via drag & drop
- Convert to PNG, ICO, and ICNS formats
- Custom dimensions (16-2048px)
- Download individual files or ZIP bundle
- Runs entirely in your browser

## How it works
- Uses HTML5 Canvas for image processing
- JSZip for creating downloadable ZIP files
- All processing happens locally in your browser
- No data is sent to any server

## Supported Formats
- **Input**: JPG, PNG, GIF, BMP, WebP
- **Output**: PNG (Linux), ICO (Windows), ICNS (macOS)

---
*Generated automatically - fully static version*
`;
  
  await fs.writeFile('dist/README.md', readme);
  
  console.log('✅ Static site built successfully in dist/ directory');
  console.log('🚀 Ready for deployment to any static hosting service');
}

buildStatic().catch(console.error);