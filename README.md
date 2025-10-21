# Icon Creator

A fully client-side web tool to convert images to native app icon formats (ICO, ICNS, PNG) with custom dimensions. No server required!

## ✨ Features

- **🖥️ 100% Client-Side**: All processing happens in your browser - no data sent to servers
- **🎯 Multiple Format Support**: Convert to ICO (Windows), ICNS (macOS), and PNG (Linux) formats
- **📐 Custom Dimensions**: Set width and height independently (16-2048px)
- **🎨 Drag & Drop Interface**: Easy file upload with visual feedback
- **📦 Batch Download**: Download all formats as a ZIP file
- **👀 Real-time Preview**: See your image before conversion
- **✅ File Validation**: Supports JPG, PNG, GIF, BMP, and WebP input formats
- **🚀 Static Hosting**: Deploy to any static hosting service (GitHub Pages, Netlify, Vercel, etc.)

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd icon-creator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:8080`

### Static Build for Deployment

1. **Build the static site**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` directory**
   - Upload to any static hosting service
   - Works with GitHub Pages, Netlify, Vercel, etc.
   - No server configuration required

## 📖 Usage

1. **Upload an image**: Drag and drop an image file or click to browse
2. **Set dimensions**: Choose your desired width and height (16-2048px)
3. **Convert**: Click "Convert to Icons" to process your image
4. **Download**: Download individual formats or get all formats in a ZIP file

## 📁 Supported Formats

### Input Formats
- JPEG/JPG
- PNG
- GIF
- BMP
- WebP

### Output Formats
- **PNG**: Universal format (Linux and others)
- **ICO**: Windows icon format (simplified)
- **ICNS**: macOS icon format (simplified)

## 🛠️ Technical Details

- **Frontend**: HTML5 Canvas for image processing
- **Libraries**: JSZip for archive creation
- **Processing**: Client-side Canvas API for image resizing
- **Storage**: Blob URLs for temporary file handling
- **Memory Management**: Automatic cleanup of temporary URLs

## 🌐 Deployment Options

### GitHub Pages
```bash
npm run build
# Push the dist/ directory to gh-pages branch
```

### Netlify
1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`

### Vercel
1. Connect your repository
2. Set build command: `npm run build`
3. Set output directory: `dist`

## 📝 Scripts

- `npm run dev` - Start development server with live reload
- `npm run build` - Build static site for deployment
- `npm run build:pages` - Alias for build command

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for personal and commercial purposes.

---

**Note**: This is a client-side only version. All image processing happens locally in your browser for maximum privacy and performance.