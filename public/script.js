const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const uploadForm = document.getElementById('uploadForm');
const convertBtn = document.getElementById('convertBtn');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const previewLabel = document.getElementById('previewLabel');
const results = document.getElementById('results');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const sizeControls = document.getElementById('sizeControls');
const macosMenubarCheckbox = document.getElementById('macosMenubar');
const sliderControls = document.getElementById('sliderControls');
const thresholdInput = document.getElementById('threshold');
const thresholdValue = document.getElementById('thresholdValue');
const thicknessInput = document.getElementById('thickness');
const thicknessValue = document.getElementById('thicknessValue');
const iconPreviewGrid = document.getElementById('iconPreviewGrid');

let selectedFile = null;
let processedImages = {};
let convertedPNGs = {};

const ELECTRON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function createICOFromPNG(pngBlob, width, height) {
  const pngArrayBuffer = await pngBlob.arrayBuffer();
  const pngData = new Uint8Array(pngArrayBuffer);
  
  const header = new ArrayBuffer(6);
  const headerView = new DataView(header);
  headerView.setUint16(0, 0, true);
  headerView.setUint16(2, 1, true);
  headerView.setUint16(4, 1, true);
  
  const dirEntry = new ArrayBuffer(16);
  const dirView = new DataView(dirEntry);
  dirView.setUint8(0, width === 256 ? 0 : width);
  dirView.setUint8(1, height === 256 ? 0 : height);
  dirView.setUint8(2, 0);
  dirView.setUint8(3, 0);
  dirView.setUint16(4, 1, true);
  dirView.setUint16(6, 32, true);
  dirView.setUint32(8, pngData.length, true);
  dirView.setUint32(12, 22, true);
  
  const result = new Uint8Array(22 + pngData.length);
  result.set(new Uint8Array(header), 0);
  result.set(new Uint8Array(dirEntry), 6);
  result.set(pngData, 22);
  
  return result.buffer;
}

async function createICNSFromPNG(pngBlob, width, height) {
  const pngArrayBuffer = await pngBlob.arrayBuffer();
  const pngData = new Uint8Array(pngArrayBuffer);
  
  let icnsType;
  switch (width) {
    case 16: icnsType = 'ic04'; break;
    case 32: icnsType = 'ic05'; break;
    case 128: icnsType = 'ic07'; break;
    case 256: icnsType = 'ic08'; break;
    case 512: icnsType = 'ic09'; break;
    case 1024: icnsType = 'ic10'; break;
    default: icnsType = 'ic08'; break;
  }
  
  const headerSize = 8;
  const iconSize = 8 + pngData.length;
  const totalSize = headerSize + iconSize;
  
  const result = new ArrayBuffer(totalSize);
  const view = new DataView(result);
  
  view.setUint32(0, 0x69636e73);
  view.setUint32(4, totalSize);
  
  const typeBytes = new TextEncoder().encode(icnsType);
  view.setUint8(8, typeBytes[0]);
  view.setUint8(9, typeBytes[1]);
  view.setUint8(10, typeBytes[2]);
  view.setUint8(11, typeBytes[3]);
  view.setUint32(12, iconSize);
  
  const resultArray = new Uint8Array(result);
  resultArray.set(pngData, 16);
  
  return result;
}

function dilateImage(imageData, iterations) {
  if (iterations <= 0) return imageData;
  
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let iter = 0; iter < iterations; iter++) {
    const original = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // If current pixel is already white, skip
        if (original[idx + 3] === 255) continue;
        
        // Check 8 neighbors (and center)
        let hasWhiteNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nidx = (ny * width + nx) * 4;
              if (original[nidx + 3] === 255) {
                hasWhiteNeighbor = true;
                break;
              }
            }
          }
          if (hasWhiteNeighbor) break;
        }
        
        // If has white neighbor, make this pixel white
        if (hasWhiteNeighbor) {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }
  }
  
  return new ImageData(data, width, height);
}

function erodeImage(imageData, iterations) {
  if (iterations <= 0) return imageData;
  
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let iter = 0; iter < iterations; iter++) {
    const original = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // If current pixel is already transparent, skip
        if (original[idx + 3] === 0) continue;
        
        // Check 8 neighbors - if ANY neighbor is transparent, erode this pixel
        let hasTransparentNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Skip center
            
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nidx = (ny * width + nx) * 4;
              if (original[nidx + 3] === 0) {
                hasTransparentNeighbor = true;
                break;
              }
            } else {
              // Edge pixels count as having transparent neighbor
              hasTransparentNeighbor = true;
              break;
            }
          }
          if (hasTransparentNeighbor) break;
        }
        
        // If has transparent neighbor, make this pixel transparent (erode)
        if (hasTransparentNeighbor) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        }
      }
    }
  }
  
  return new ImageData(data, width, height);
}

async function convertToMacOSMenubarIcon(img, thresholdValue = 127, thicknessValue = 0) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = img.width;
  canvas.height = img.height;
  
  // Draw the image
  ctx.drawImage(img, 0, 0);
  
  // Get image data
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Use the provided threshold value (0-255)
  // Lower values = more detail, higher values = simpler/more abstract
  const threshold = thresholdValue;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Calculate luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Combine luminance with alpha to determine if pixel should be visible
    // This creates a clean threshold effect like Apple's menubar icons
    const effectiveAlpha = (a / 255) * (luminance / 255);
    
    // Create hard-edged silhouette with threshold
    // Pixels above threshold become solid white, below become transparent
    if (effectiveAlpha > (threshold / 255) && a > 10) {
      data[i] = 255;     // R - white
      data[i + 1] = 255; // G - white
      data[i + 2] = 255; // B - white
      data[i + 3] = 255; // A - fully opaque
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;   // Fully transparent
    }
  }
  
  // Apply morphological operations based on thickness value
  // Positive values = dilate (thicken), negative values = erode (thin)
  if (thicknessValue > 0) {
    imageData = dilateImage(imageData, thicknessValue);
  } else if (thicknessValue < 0) {
    imageData = erodeImage(imageData, Math.abs(thicknessValue));
  }
  
  // Put modified data back
  ctx.putImageData(imageData, 0, 0);
  
  // Return new image
  const processedImg = new Image();
  await new Promise((resolve, reject) => {
    processedImg.onload = resolve;
    processedImg.onerror = reject;
    processedImg.src = canvas.toDataURL('image/png');
  });
  
  return processedImg;
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

document.querySelectorAll('input[name="conversionMode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'electron') {
      sizeControls.style.opacity = '0.5';
      sizeControls.style.pointerEvents = 'none';
    } else {
      sizeControls.style.opacity = '1';
      sizeControls.style.pointerEvents = 'auto';
    }
  });
});

macosMenubarCheckbox.addEventListener('change', async () => {
  if (macosMenubarCheckbox.checked) {
    sliderControls.classList.remove('hidden');
  } else {
    sliderControls.classList.add('hidden');
  }
  
  if (selectedFile) {
    await updatePreview();
  }
});

thresholdInput.addEventListener('input', async () => {
  thresholdValue.textContent = thresholdInput.value;
  if (selectedFile && macosMenubarCheckbox.checked) {
    await updatePreview();
  }
});

thicknessInput.addEventListener('input', async () => {
  thicknessValue.textContent = thicknessInput.value;
  if (selectedFile && macosMenubarCheckbox.checked) {
    await updatePreview();
  }
});

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

async function updatePreview() {
  if (!selectedFile) return;
  
  const applyMacOSMenubar = macosMenubarCheckbox.checked;
  
  if (applyMacOSMenubar) {
    // Load image and apply preprocessing
    const img = new Image();
    const imageLoaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    img.src = URL.createObjectURL(selectedFile);
    await imageLoaded;
    
    // Convert to macOS menubar style
    const threshold = parseInt(thresholdInput.value);
    const thickness = parseInt(thicknessInput.value);
    const processedImg = await convertToMacOSMenubarIcon(img, threshold, thickness);
    previewImg.src = processedImg.src;
    previewLabel.classList.remove('hidden');
    
    URL.revokeObjectURL(img.src);
  } else {
    // Show original image
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
    };
    reader.readAsDataURL(selectedFile);
    previewLabel.classList.add('hidden');
  }
  
  preview.classList.remove('hidden');
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
  updatePreview();

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

  const mode = document.querySelector('input[name="conversionMode"]:checked').value;

  showLoading();
  hideError();

  try {
    if (mode === 'electron') {
      await processElectronSizes(selectedFile);
    } else {
      const width = parseInt(widthInput.value);
      const height = parseInt(heightInput.value);

      if (width < 16 || width > 2048 || height < 16 || height > 2048) {
        showError('Width and height must be between 16 and 2048 pixels.');
        hideLoading();
        return;
      }

      await processImageClientSide(selectedFile, width, height);
    }
    showResults();
  } catch (err) {
    showError(err.message || 'Error processing image');
  } finally {
    hideLoading();
  }
});

async function createImageAtSize(img, size, applyMacOSMenubar = false, threshold = 127, thickness = 0) {
  let imageToUse = img;
  
  // Apply macOS menubar preprocessing if requested
  if (applyMacOSMenubar) {
    imageToUse = await convertToMacOSMenubarIcon(img, threshold, thickness);
  }
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(imageToUse, 0, 0, size, size);
  
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function processElectronSizes(file) {
  const img = new Image();
  const imageLoaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  
  img.src = URL.createObjectURL(file);
  await imageLoaded;
  
  const applyMacOSMenubar = macosMenubarCheckbox.checked;
  const threshold = parseInt(thresholdInput.value);
  const thickness = parseInt(thicknessInput.value);
  
  // Clear previous converted PNGs
  convertedPNGs = {};
  
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const baseName = file.name.split('.')[0] || 'icon';
    
    for (const size of ELECTRON_SIZES) {
      const pngBlob = await createImageAtSize(img, size, applyMacOSMenubar, threshold, thickness);
      zip.file(`${baseName}_${size}x${size}.png`, pngBlob);
      
      // Store PNG blob for preview
      convertedPNGs[size] = URL.createObjectURL(pngBlob);
      
      const icoBuffer = await createICOFromPNG(pngBlob, size, size);
      const icoBlob = new Blob([icoBuffer], { type: 'image/x-icon' });
      zip.file(`${baseName}_${size}x${size}.ico`, icoBlob);
      
      const icnsBuffer = await createICNSFromPNG(pngBlob, size, size);
      const icnsBlob = new Blob([icnsBuffer], { type: 'image/icns' });
      zip.file(`${baseName}_${size}x${size}.icns`, icnsBlob);
    }
    
    const zipBlob = await zip.generateAsync({type: 'blob'});
    processedImages.zip = URL.createObjectURL(zipBlob);
    processedImages.isMultiSize = true;
  }
  
  URL.revokeObjectURL(img.src);
}

async function processImageClientSide(file, width, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const img = new Image();
  const imageLoaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  
  img.src = URL.createObjectURL(file);
  await imageLoaded;
  
  const applyMacOSMenubar = macosMenubarCheckbox.checked;
  const threshold = parseInt(thresholdInput.value);
  const thickness = parseInt(thicknessInput.value);
  let imageToUse = img;
  
  // Apply macOS menubar preprocessing if requested
  if (applyMacOSMenubar) {
    imageToUse = await convertToMacOSMenubarIcon(img, threshold, thickness);
  }
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imageToUse, 0, 0, width, height);
  
  const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  processedImages.png = URL.createObjectURL(pngBlob);
  
  // Store PNG for preview
  convertedPNGs = {};
  convertedPNGs[`${width}x${height}`] = processedImages.png;
  
  const icoBuffer = await createICOFromPNG(pngBlob, width, height);
  const icoBlob = new Blob([icoBuffer], { type: 'image/x-icon' });
  processedImages.ico = URL.createObjectURL(icoBlob);
  
  const icnsBuffer = await createICNSFromPNG(pngBlob, width, height);
  const icnsBlob = new Blob([icnsBuffer], { type: 'image/icns' });
  processedImages.icns = URL.createObjectURL(icnsBlob);
  
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const baseName = file.name.split('.')[0] || 'icon';
    
    zip.file(`${baseName}_${width}x${height}.png`, pngBlob);
    zip.file(`${baseName}_${width}x${height}.ico`, icoBlob);
    zip.file(`${baseName}_${width}x${height}.icns`, icnsBlob);
    
    const zipBlob = await zip.generateAsync({type: 'blob'});
    processedImages.zip = URL.createObjectURL(zipBlob);
  }
  
  processedImages.isMultiSize = false;
  
  URL.revokeObjectURL(img.src);
}

function showResults() {
  const baseName = selectedFile.name.split('.')[0] || 'icon';
  
  const downloadPng = document.getElementById('downloadPng');
  const downloadIco = document.getElementById('downloadIco');
  const downloadIcns = document.getElementById('downloadIcns');
  const downloadAll = document.getElementById('downloadAll');
  
  // Update icon preview
  updateIconPreview();
  
  if (processedImages.isMultiSize) {
    downloadPng.style.display = 'none';
    downloadIco.style.display = 'none';
    downloadIcns.style.display = 'none';
    
    downloadAll.href = processedImages.zip;
    downloadAll.download = `${baseName}_electron_icons.zip`;
    downloadAll.innerHTML = downloadAll.innerHTML.replace(/Download All.*?(?=<\/a>|$)/, 'Download All Electron Sizes (ZIP)');
  } else {
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    
    downloadPng.style.display = 'flex';
    downloadIco.style.display = 'flex';
    downloadIcns.style.display = 'flex';
    
    downloadPng.href = processedImages.png;
    downloadPng.download = `${baseName}_${width}x${height}.png`;
    
    downloadIco.href = processedImages.ico;
    downloadIco.download = `${baseName}_${width}x${height}.ico`;
    
    downloadIcns.href = processedImages.icns;
    downloadIcns.download = `${baseName}_${width}x${height}.icns`;
    
    if (processedImages.zip) {
      downloadAll.href = processedImages.zip;
      downloadAll.download = `${baseName}_icons_${width}x${height}.zip`;
      downloadAll.innerHTML = downloadAll.innerHTML.replace(/Download All.*?(?=<\/a>|$)/, 'Download All (ZIP)');
    }
  }
  
  results.classList.remove('hidden');
}

function updateIconPreview() {
  // Clear previous previews
  iconPreviewGrid.innerHTML = '';
  
  // Check if we have converted PNGs to display
  const sizes = Object.keys(convertedPNGs);
  if (sizes.length === 0) return;
  
  // Sort sizes numerically
  sizes.sort((a, b) => {
    const sizeA = typeof a === 'string' ? parseInt(a) : a;
    const sizeB = typeof b === 'string' ? parseInt(b) : b;
    return sizeA - sizeB;
  });
  
  // Create preview items
  sizes.forEach(size => {
    const previewItem = document.createElement('div');
    previewItem.className = 'icon-preview-item';
    
    const img = document.createElement('img');
    img.src = convertedPNGs[size];
    img.alt = `Icon ${size}`;
    
    // Set display size based on actual size
    const displaySize = typeof size === 'string' ? parseInt(size) : size;
    const maxDisplaySize = 64;
    const actualDisplaySize = Math.min(displaySize, maxDisplaySize);
    img.style.width = `${actualDisplaySize}px`;
    img.style.height = `${actualDisplaySize}px`;
    
    const label = document.createElement('span');
    label.textContent = typeof size === 'string' ? size : `${size}×${size}`;
    
    previewItem.appendChild(img);
    previewItem.appendChild(label);
    iconPreviewGrid.appendChild(previewItem);
  });
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

window.addEventListener('beforeunload', () => {
  Object.values(processedImages).forEach(url => {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
});
