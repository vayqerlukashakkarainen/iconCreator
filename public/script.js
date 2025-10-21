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

// Allow independent width/height values
widthInput.addEventListener('input', validateDimensions);
heightInput.addEventListener('input', validateDimensions);

function validateDimensions() {
  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);
  
  // Just validate ranges, don't sync values
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

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('width', width);
  formData.append('height', height);

  try {
    const response = await fetch('/convert', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Conversion failed');
    }

    showResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
});

function showResults(data) {
  document.getElementById('downloadPng').href = data.files.png;
  document.getElementById('downloadIco').href = data.files.ico;
  document.getElementById('downloadIcns').href = data.files.icns;
  document.getElementById('downloadAll').href = data.zipAll;
  
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