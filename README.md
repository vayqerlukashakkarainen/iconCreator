# Icon Creator

A simple Node.js web application that converts images to native app icon formats (ICO, ICNS, PNG) with customizable dimensions.

## Features

- Upload images via drag & drop or file browser
- Convert to Windows ICO, macOS ICNS, and Linux PNG formats
- Specify custom width/height (16-2048 pixels)
- Clean, responsive web interface
- Support for multiple image formats (JPG, PNG, GIF, BMP, WebP)

## Installation

```bash
npm install
```

## Usage

Start the development server:
```bash
npm run dev
```

Or start the production server:
```bash
npm start
```

Visit `http://localhost:3000` in your browser.

## API Endpoints

- `POST /convert` - Upload and convert image
- `GET /download/:timestamp/:filename` - Download converted files

## Dependencies

- Express.js - Web server
- Multer - File upload handling
- Sharp - Image processing
- png2icons - ICO/ICNS conversion