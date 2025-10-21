const fs = require('fs').promises;
const path = require('path');

async function buildPages() {
  console.log('Building static site for GitHub Pages...');
  
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
  
  // Read the original HTML file
  let html = await fs.readFile('dist/index.html', 'utf8');
  
  // Replace the script source to use a GitHub Pages compatible version
  html = html.replace('script.js', 'script-pages.js');
  
  // Write the modified HTML
  await fs.writeFile('dist/index.html', html);
  
  // Create a GitHub Pages compatible script
  let script = await fs.readFile('public/script.js', 'utf8');
  
  // Replace API endpoints to use GitHub API or show demo message
  script = script.replace(
    "const response = await fetch('/convert', {",
    `// GitHub Pages Demo Mode
    showError('This is a demo version hosted on GitHub Pages. The full conversion functionality requires a server. Clone the repository and run locally with "npm start" for full functionality.');
    return;
    
    const response = await fetch('/convert', {`
  );
  
  await fs.writeFile('dist/script-pages.js', script);
  
  // Create a README for the github-pages branch
  const readme = `# Icon Creator - GitHub Pages Demo

This is a demo version of the Icon Creator application hosted on GitHub Pages.

## ⚠️ Limited Functionality
This GitHub Pages version shows the interface but cannot perform actual image conversion since it's a static site.

## 🚀 Full Version
For the complete functionality including image conversion:

1. Clone this repository
2. Run \`npm install\`
3. Run \`npm start\`
4. Visit http://localhost:3000

## Features (Full Version)
- Upload images via drag & drop
- Convert to ICO (Windows), ICNS (macOS), PNG (Linux) formats
- Custom dimensions (16-2048px)
- Download individual files or ZIP bundle

---
*Generated automatically from the main branch*
`;
  
  await fs.writeFile('dist/README.md', readme);
  
  console.log('✅ Static site built successfully in dist/ directory');
}

buildPages().catch(console.error);