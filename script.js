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
  
  // For ICO, we'll use a simple approach - just convert the PNG
  // In a real implementation, you'd want to use a proper ICO library
  processedImages.ico = processedImages.png; // Simplified for now
  
  // For ICNS, we'll also use PNG as a placeholder
  processedImages.icns = processedImages.png; // Simplified for now
  
  // Create ZIP file with JSZip
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const baseName = file.name.split('.')[0] || 'icon';
    
    zip.file(`${baseName}_${width}x${height}.png`, pngBlob);
    zip.file(`${baseName}_${width}x${height}.ico`, pngBlob); // Using PNG for now
    zip.file(`${baseName}_${width}x${height}.icns`, pngBlob); // Using PNG for now
    
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