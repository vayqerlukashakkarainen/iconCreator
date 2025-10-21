const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const png2icons = require('png2icons');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3000;

const upload = multer({ 
  dest: 'temp/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

app.use(express.static('public'));
app.use(express.json());

const ensureDirectories = async () => {
  await fs.mkdir('temp', { recursive: true });
  await fs.mkdir('output', { recursive: true });
};

const convertToPng = async (inputPath, outputPath, width, height) => {
  await sharp(inputPath)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
};

const convertToIco = async (pngPath, outputPath) => {
  const pngBuffer = await fs.readFile(pngPath);
  const icoBuffer = png2icons.createICO(pngBuffer, png2icons.BILINEAR, 0, false);
  await fs.writeFile(outputPath, icoBuffer);
};

const convertToIcns = async (pngPath, outputPath) => {
  const pngBuffer = await fs.readFile(pngPath);
  const icnsBuffer = png2icons.createICNS(pngBuffer, png2icons.BILINEAR, 0);
  await fs.writeFile(outputPath, icnsBuffer);
};

app.post('/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { width = 512, height = 512 } = req.body;
    const parsedWidth = parseInt(width);
    const parsedHeight = parseInt(height);

    if (parsedWidth < 16 || parsedWidth > 2048 || parsedHeight < 16 || parsedHeight > 2048) {
      return res.status(400).json({ error: 'Width and height must be between 16 and 2048 pixels' });
    }

    const timestamp = Date.now();
    const outputDir = `output/${timestamp}`;
    await fs.mkdir(outputDir, { recursive: true });

    const pngPath = `${outputDir}/app-icon.png`;
    const icoPath = `${outputDir}/app-icon.ico`;
    const icnsPath = `${outputDir}/app-icon.icns`;

    await convertToPng(req.file.path, pngPath, parsedWidth, parsedHeight);
    await convertToIco(pngPath, icoPath);
    await convertToIcns(pngPath, icnsPath);

    await fs.unlink(req.file.path);

    res.json({
      success: true,
      files: {
        png: `/download/${timestamp}/app-icon.png`,
        ico: `/download/${timestamp}/app-icon.ico`,
        icns: `/download/${timestamp}/app-icon.icns`
      },
      zipAll: `/download-all/${timestamp}`,
      dimensions: { width: parsedWidth, height: parsedHeight }
    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Failed to convert image' });
  }
});

app.get('/download/:timestamp/:filename', async (req, res) => {
  try {
    const { timestamp, filename } = req.params;
    const filePath = `output/${timestamp}/${filename}`;
    
    await fs.access(filePath);
    res.download(filePath);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.get('/download-all/:timestamp', async (req, res) => {
  try {
    const { timestamp } = req.params;
    const outputDir = `output/${timestamp}`;
    
    await fs.access(outputDir);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="app-icons.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      res.status(500).json({ error: 'Failed to create zip file' });
    });

    archive.pipe(res);

    archive.file(`${outputDir}/app-icon.png`, { name: 'app-icon.png' });
    archive.file(`${outputDir}/app-icon.ico`, { name: 'app-icon.ico' });
    archive.file(`${outputDir}/app-icon.icns`, { name: 'app-icon.icns' });

    await archive.finalize();
  } catch (error) {
    res.status(404).json({ error: 'Files not found' });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

const startServer = async () => {
  await ensureDirectories();
  app.listen(PORT, () => {
    console.log(`Icon Creator server running at http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);