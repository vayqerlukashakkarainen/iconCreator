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
const sizeControls = document.getElementById('sizeControls');

let selectedFile = null;
let processedImages = {};

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

async function createImageAtSize(img, size) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);
  
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
  
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const baseName = file.name.split('.')[0] || 'icon';
    
    for (const size of ELECTRON_SIZES) {
      const pngBlob = await createImageAtSize(img, size);
      zip.file(`${baseName}_${size}x${size}.png`, pngBlob);
      
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
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  
  const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  processedImages.png = URL.createObjectURL(pngBlob);
  
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
