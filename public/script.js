const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const uploadForm = document.getElementById('uploadForm');
const convertBtn = document.getElementById('convertBtn');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const results = document.getElementById('results');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');

let selectedFile = null;
let processedImages = {};

// ICO format creation function
async function createICOFromPNG(pngBlob, width, height) {
  const pngArrayBuffer = await pngBlob.arrayBuffer();
  const pngData = new Uint8Array(pngArrayBuffer);
  
  // ICO file header (6 bytes)
  const header = new ArrayBuffer(6);
  const headerView = new DataView(header);
  headerView.setUint16(0, 0, true);      // Reserved (must be 0)
  headerView.setUint16(2, 1, true);      // Image type (1 = ICO)
  headerView.setUint16(4, 1, true);      // Number of images
  
  // ICO directory entry (16 bytes)
  const dirEntry = new ArrayBuffer(16);
  const dirView = new DataView(dirEntry);
  dirView.setUint8(0, width === 256 ? 0 : width);   // Width (0 = 256)
  dirView.setUint8(1, height === 256 ? 0 : height); // Height (0 = 256)
  dirView.setUint8(2, 0);                            // Color palette (0 = no palette)
  dirView.setUint8(3, 0);                            // Reserved
  dirView.setUint16(4, 1, true);                     // Color planes
  dirView.setUint16(6, 32, true);                    // Bits per pixel
  dirView.setUint32(8, pngData.length, true);       // Size of image data
  dirView.setUint32(12, 22, true);                   // Offset to image data (6 + 16 = 22)
  
  // Combine all parts
  const result = new Uint8Array(22 + pngData.length);
  result.set(new Uint8Array(header), 0);
  result.set(new Uint8Array(dirEntry), 6);
  result.set(pngData, 22);
  
  return result.buffer;
}

// ICNS format creation function
async function createICNSFromPNG(pngBlob, width, height) {
  const pngArrayBuffer = await pngBlob.arrayBuffer();
  const pngData = new Uint8Array(pngArrayBuffer);
  
  // Determine ICNS type based on size
  let icnsType;
  switch (width) {
    case 16: icnsType = 'ic04'; break;
    case 32: icnsType = 'ic05'; break;
    case 128: icnsType = 'ic07'; break;
    case 256: icnsType = 'ic08'; break;
    case 512: icnsType = 'ic09'; break;
    case 1024: icnsType = 'ic10'; break;
    default: icnsType = 'ic08'; break; // Default to 256x256
  }
  
  // ICNS header (8 bytes)
  const headerSize = 8;
  const iconSize = 8 + pngData.length;
  const totalSize = headerSize + iconSize;
  
  const result = new ArrayBuffer(totalSize);
  const view = new DataView(result);
  
  // File header
  view.setUint32(0, 0x69636e73); // 'icns' magic
  view.setUint32(4, totalSize);   // Total file size
  
  // Icon entry
  const typeBytes = new TextEncoder().encode(icnsType);
  view.setUint8(8, typeBytes[0]);
  view.setUint8(9, typeBytes[1]);
  view.setUint8(10, typeBytes[2]);
  view.setUint8(11, typeBytes[3]);
  view.setUint32(12, iconSize); // Icon data size including header
  
  // PNG data
  const resultArray = new Uint8Array(result);
  resultArray.set(pngData, 16);
  
  return result;
}

uploadArea.addEventListener('click', () => imageInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

imageInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

widthInput.addEventListener('input', validateDimensions);
heightInput.addEventListener('input', validateDimensions);

function validateDimensions() {
  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);
  
  if (width < 16 || width > 2048) {
    widthInput.style.borderColor = '#dc3545';
  } else {
    widthInput.style.borderColor = '#ddd';
  }
  
  if (height < 16 || height > 2048) {
    heightInput.style.borderColor = '#dc3545';
  } else {
    heightInput.style.borderColor = '#ddd';
  }
}

function handleFileSelect(file) {
  if (!file.type.startsWith('image/')) {
    showError('Please select a valid image file.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError('File size must be less than 10MB.');
    return;
  }

  selectedFile = file;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);

  convertBtn.disabled = false;
  hideError();
  results.classList.add('hidden');
}

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!selectedFile) {
    showError('Please select an image file.');
    return;
  }

  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);

  if (width < 16 || width > 2048 || height < 16 || height > 2048) {
    showError('Width and height must be between 16 and 2048 pixels.');
    return;
  }

  showLoading();
  hideError();

  try {
    await processImageClientSide(selectedFile, width, height);
    showResults();
  } catch (err) {
    showError(err.message || 'Error processing image');
  } finally {
    hideLoading();
  }
});

async function processImageClientSide(file, width, height) {
  // Create canvas for image processing
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Load image
  const img = new Image();
  const imageLoaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  
  img.src = URL.createObjectURL(file);
  await imageLoaded;
  
  // Set canvas size and draw resized image
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  
  // Generate PNG
  const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  processedImages.png = URL.createObjectURL(pngBlob);
  
  // Convert to ICO format using native implementation
  const icoBuffer = await createICOFromPNG(pngBlob, width, height);
  const icoBlob = new Blob([icoBuffer], { type: 'image/x-icon' });
  processedImages.ico = URL.createObjectURL(icoBlob);
  
  // Convert to ICNS format using native implementation
  const icnsBuffer = await createICNSFromPNG(pngBlob, width, height);
  const icnsBlob = new Blob([icnsBuffer], { type: 'image/icns' });
  processedImages.icns = URL.createObjectURL(icnsBlob);
  
  // Create ZIP file with JSZip
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const baseName = file.name.split('.')[0] || 'icon';
    
    zip.file(`${baseName}_${width}x${height}.png`, pngBlob);
    zip.file(`${baseName}_${width}x${height}.ico`, icoBlob);
    zip.file(`${baseName}_${width}x${height}.icns`, icnsBlob);
    
    const zipBlob = await zip.generateAsync({type: 'blob'});
    processedImages.zip = URL.createObjectURL(zipBlob);
  }
  
  // Cleanup temporary URL
  URL.revokeObjectURL(img.src);
}

function showResults() {
  const baseName = selectedFile.name.split('.')[0] || 'icon';
  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);
  
  const downloadPng = document.getElementById('downloadPng');
  const downloadIco = document.getElementById('downloadIco');
  const downloadIcns = document.getElementById('downloadIcns');
  const downloadAll = document.getElementById('downloadAll');
  
  downloadPng.href = processedImages.png;
  downloadPng.download = `${baseName}_${width}x${height}.png`;
  
  downloadIco.href = processedImages.ico;
  downloadIco.download = `${baseName}_${width}x${height}.ico`;
  
  downloadIcns.href = processedImages.icns;
  downloadIcns.download = `${baseName}_${width}x${height}.icns`;
  
  if (processedImages.zip) {
    downloadAll.href = processedImages.zip;
    downloadAll.download = `${baseName}_icons_${width}x${height}.zip`;
  }
  
  results.classList.remove('hidden');
}

function showLoading() {
  loading.classList.remove('hidden');
  convertBtn.disabled = true;
}

function hideLoading() {
  loading.classList.add('hidden');
  convertBtn.disabled = false;
}

function showError(message) {
  error.textContent = message;
  error.classList.remove('hidden');
}

function hideError() {
  error.classList.add('hidden');
}

// Cleanup URLs when page unloads to prevent memory leaks
window.addEventListener('beforeunload', () => {
  Object.values(processedImages).forEach(url => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
});