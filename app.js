// Food GI Scanner - Core Application Logic

let currentBase64Image = null;
let currentMimeType = 'image/jpeg';
let deferredPrompt = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }

  // Check saved API key
  checkApiKeyStatus();
  loadHistory();
  setupEventListeners();
  setupPwaInstall();
  updateQrUrl();
});

// Setup PWA Installation
function setupPwaInstall() {
  const installBtn = document.getElementById('pwaInstallBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });

  window.addEventListener('appinstalled', () => {
    installBtn.classList.add('hidden');
    console.log('Food GI PWA installed successfully');
  });
}

// API Key Management
function checkApiKeyStatus() {
  const apiKey = localStorage.getItem('gemini_api_key');
  const dot = document.getElementById('apiKeyDot');
  const banner = document.getElementById('apiKeyBanner');

  if (apiKey && apiKey.trim().length > 10) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-1.5 ring-2 ring-slate-900';
    banner.classList.add('hidden');
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400 absolute top-1.5 right-1.5 ring-2 ring-slate-900';
    banner.classList.remove('hidden');
  }
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const input = document.getElementById('apiKeyInput');
  const select = document.getElementById('modelSelect');

  input.value = localStorage.getItem('gemini_api_key') || '';
  select.value = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('modelSelect').value;

  if (key) {
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('gemini_model', model);
    checkApiKeyStatus();
    closeSettingsModal();
    alert('✅ Gemini API Key successfully saved!');
  } else {
    alert('Kripya valid API Key enter karein.');
  }
}

// Event Listeners for Camera and Files
function setupEventListeners() {
  const cameraInput = document.getElementById('cameraInput');
  const galleryInput = document.getElementById('galleryInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const openQrBtn = document.getElementById('openQrBtn');

  cameraInput.addEventListener('change', (e) => handleImageSelected(e.target.files[0]));
  galleryInput.addEventListener('change', (e) => handleImageSelected(e.target.files[0]));
  analyzeBtn.addEventListener('click', analyzeFoodImage);
  openSettingsBtn.addEventListener('click', openSettingsModal);
  openQrBtn.addEventListener('click', openQrModal);

  // Click on empty state triggers camera/file
  document.getElementById('previewContainer').addEventListener('click', (e) => {
    if (!currentBase64Image && !e.target.closest('button')) {
      cameraInput.click();
    }
  });
}

// Handle Image Compression & Preview
function handleImageSelected(file) {
  if (!file) return;

  hideError();
  document.getElementById('resultCard').classList.add('hidden');

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Downscale image to max 1024px for fast API response
      const maxDim = 1024;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      currentBase64Image = compressedDataUrl.split(',')[1];
      currentMimeType = 'image/jpeg';

      // Show preview
      const previewImg = document.getElementById('imagePreview');
      previewImg.src = compressedDataUrl;
      previewImg.classList.remove('hidden');
      document.getElementById('emptyState').classList.add('hidden');
      document.getElementById('analyzeBtn').classList.remove('hidden');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// Sample Foods for Instant Demo Testing
function loadSampleFood(type) {
  const sampleData = {
    apple: {
      name: "Fresh Red Apple",
      url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80"
    },
    rice: {
      name: "Steamed White Rice",
      url: "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=600&auto=format&fit=crop&q=80"
    },
    roti: {
      name: "Wheat Roti with Dal",
      url: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80"
    },
    gulabjamun: {
      name: "Gulab Jamun Sweet",
      url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80"
    }
  };

  const sample = sampleData[type];
  if (!sample) return;

  // Fetch sample as base64
  fetch(sample.url)
    .then(res => res.blob())
    .then(blob => {
      handleImageSelected(blob);
    })
    .catch(err => {
      alert("Sample image load nahi ho saki. Kripya Camera ya Gallery se photo upload karein.");
    });
}

// Main AI Analysis
async function analyzeFoodImage() {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey || apiKey.trim().length < 10) {
    openSettingsModal();
    showError("API Key Missing", "Kripya pehle apni Gemini API Key daalein.");
    return;
  }

  if (!currentBase64Image) {
    showError("No Photo", "Kripya pehle kisi food ki photo kheechein ya upload karein.");
    return;
  }

  // Show Scanning UI
  setScanning(true);
  hideError();
  document.getElementById('resultCard').classList.add('hidden');

  const modelsToTry = [
    localStorage.getItem('gemini_model') || 'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  let resultData = null;
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      updateScanStatus(`Analyzing with ${model}...`);
      resultData = await callGeminiVisionApi(model, apiKey, currentBase64Image, currentMimeType);
      if (resultData) break;
    } catch (err) {
      console.warn(`Model ${model} failed, trying next fallback:`, err);
      lastError = err;
    }
  }

  setScanning(false);

  if (resultData) {
    displayResult(resultData);
    saveToHistory(resultData, document.getElementById('imagePreview').src);
  } else {
    showError("Analysis Failed", lastError ? lastError.message : "Food pehchana nahi ja saka. Kripya saaf photo lein aur dobara koshish karein.");
  }
}

// Call Google Gemini Vision API
async function callGeminiVisionApi(model, apiKey, base64Data, mimeType) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptText = `
You are a World-Class Clinical Nutritionist and Food Biochemist specializing in the Glycemic Index (GI) and Diabetes Management.
Analyze the food items visible in this image carefully.

Return ONLY a valid JSON object matching this exact schema without any markdown backticks or commentary:
{
  "food_name": "Full English Name of dish/food",
  "food_name_hindi": "Hindi name with pronunciation (e.g. दाल चावल / Dal Chawal)",
  "description": "Short 1-sentence food description",
  "portion_size": "Standard estimated portion (e.g. 1 bowl / 150g / 1 piece)",
  "gi_score": 58,
  "gi_category": "Low" | "Medium" | "High",
  "gl_score": 12,
  "gl_category": "Low" | "Medium" | "High",
  "carbs_grams": 28,
  "sugar_grams": 4,
  "fiber_grams": 3,
  "calories_kcal": 160,
  "protein_grams": 6,
  "diabetic_verdict": "Safe" | "Moderate" | "Avoid or Limit",
  "diabetic_advice": "Detailed, practical clinical advice for diabetic or health-conscious people (explain how quickly this raises blood glucose and suggest smart hacks like adding fiber/salad/vinegar/portion size)",
  "ingredients_detected": ["Ingredient 1", "Ingredient 2"]
}

Important Guidelines:
- Glycemic Index (GI) scale: Low is 0-55, Medium is 56-69, High is 70-100.
- If multiple food items are present (e.g., Dal + Roti + Rice), calculate the combined composite meal GI.
- Ensure the numbers are realistic scientific values based on international GI tables (Sydney University GI Database).
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || `API error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  const jsonResponse = await response.json();
  const textOutput = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error("Gemini API ne koi response nahi bheja.");
  }

  // Parse JSON cleanly
  try {
    const cleanText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (err) {
    console.error("JSON parse error:", textOutput);
    throw new Error("AI output parse nahi ho paya. Dobara try karein.");
  }
}

// Display Result in UI
function displayResult(data) {
  const resultCard = document.getElementById('resultCard');
  resultCard.classList.remove('hidden');

  // Text values
  document.getElementById('foodName').innerText = data.food_name || 'Detected Food';
  document.getElementById('foodHindiDesc').innerText = `${data.food_name_hindi || ''} • ${data.description || ''}`;
  document.getElementById('portionBadge').innerText = data.portion_size || '~150g portion';

  // GI Score & Badge
  const gi = parseInt(data.gi_score) || 0;
  const giNum = document.getElementById('giScoreNumber');
  const giBadge = document.getElementById('giCategoryBadge');
  const pin = document.getElementById('giPinIndicator');
  const resultGlow = document.getElementById('resultGlow');

  giNum.innerText = gi;
  pin.style.left = `${Math.min(Math.max(gi, 2), 96)}%`;

  if (gi <= 55) {
    giNum.className = 'text-4xl font-black text-emerald-400 tracking-tighter';
    giBadge.className = 'mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    giBadge.innerText = '🟢 Low GI (≤ 55)';
    resultGlow.className = 'absolute -top-20 -right-20 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none';
  } else if (gi <= 69) {
    giNum.className = 'text-4xl font-black text-amber-400 tracking-tighter';
    giBadge.className = 'mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
    giBadge.innerText = '🟡 Medium GI (56-69)';
    resultGlow.className = 'absolute -top-20 -right-20 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none';
  } else {
    giNum.className = 'text-4xl font-black text-rose-400 tracking-tighter';
    giBadge.className = 'mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30';
    giBadge.innerText = '🔴 High GI (≥ 70)';
    resultGlow.className = 'absolute -top-20 -right-20 w-48 h-48 rounded-full bg-rose-500/20 blur-3xl pointer-events-none';
  }

  // GL Score & Badge
  const gl = parseInt(data.gl_score) || 0;
  const glNum = document.getElementById('glScoreNumber');
  const glBadge = document.getElementById('glCategoryBadge');
  glNum.innerText = gl;

  if (gl <= 10) {
    glBadge.className = 'mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30';
    glBadge.innerText = '🟢 Low Load (≤ 10)';
  } else if (gl <= 19) {
    glBadge.className = 'mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
    glBadge.innerText = '🟡 Medium Load (11-19)';
  } else {
    glBadge.className = 'mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30';
    glBadge.innerText = '🔴 High Load (≥ 20)';
  }

  // Diabetic Advice
  const verdictCard = document.getElementById('diabeticAdviceCard');
  const verdictHeading = document.getElementById('diabeticHeading');
  const verdictText = document.getElementById('diabeticAdviceText');
  const verdictIcon = document.getElementById('diabeticIcon');

  verdictText.innerText = data.diabetic_advice || 'Eat mindfully and pair with fiber.';
  verdictHeading.innerText = `Diabetic Verdict: ${data.diabetic_verdict || 'Moderation'}`;

  if (data.diabetic_verdict === 'Safe' || gi <= 55) {
    verdictCard.className = 'bg-emerald-950/40 rounded-2xl p-4 border border-emerald-500/30 space-y-2.5';
    verdictIcon.className = 'w-5 h-5 text-emerald-400';
  } else if (data.diabetic_verdict === 'Moderate' || gi <= 69) {
    verdictCard.className = 'bg-amber-950/40 rounded-2xl p-4 border border-amber-500/30 space-y-2.5';
    verdictIcon.className = 'w-5 h-5 text-amber-400';
  } else {
    verdictCard.className = 'bg-rose-950/40 rounded-2xl p-4 border border-rose-500/30 space-y-2.5';
    verdictIcon.className = 'w-5 h-5 text-rose-400';
  }

  // Nutrition Grid
  document.getElementById('nutriCarbs').innerText = `${data.carbs_grams || 0}g`;
  document.getElementById('nutriSugar').innerText = `${data.sugar_grams || 0}g`;
  document.getElementById('nutriFiber').innerText = `${data.fiber_grams || 0}g`;
  document.getElementById('nutriCalories').innerText = `${data.calories_kcal || 0} kcal`;

  // Ingredients
  const ingContainer = document.getElementById('ingredientsList');
  ingContainer.innerHTML = '';
  const ingredients = data.ingredients_detected || [];
  if (ingredients.length > 0) {
    ingredients.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/80';
      chip.innerText = item;
      ingContainer.appendChild(chip);
    });
  } else {
    ingContainer.innerHTML = '<span class="text-xs text-slate-500">Standard ingredients</span>';
  }

  // Smooth scroll to result
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// UI Helpers
function setScanning(isScanning) {
  const overlay = document.getElementById('scannerOverlay');
  const analyzeBtn = document.getElementById('analyzeBtn');

  if (isScanning) {
    overlay.classList.remove('hidden');
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    overlay.classList.add('hidden');
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

function updateScanStatus(text) {
  const statusEl = document.getElementById('scanStatusText');
  if (statusEl) statusEl.innerText = text;
}

function showError(title, message) {
  const card = document.getElementById('errorCard');
  document.getElementById('errorTitle').innerText = title;
  document.getElementById('errorMessage').innerText = message;
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth' });
}

function hideError() {
  document.getElementById('errorCard').classList.add('hidden');
}

// History Storage & Display
function saveToHistory(item, thumbUrl) {
  try {
    let history = JSON.parse(localStorage.getItem('food_gi_history') || '[]');
    history.unshift({
      name: item.food_name,
      gi: item.gi_score,
      verdict: item.diabetic_verdict,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      thumb: thumbUrl
    });
    if (history.length > 15) history.pop();
    localStorage.setItem('food_gi_history', JSON.stringify(history));
    loadHistory();
  } catch (e) {
    console.warn("History save error:", e);
  }
}

function loadHistory() {
  const container = document.getElementById('historyList');
  try {
    const history = JSON.parse(localStorage.getItem('food_gi_history') || '[]');
    if (history.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Abhi tak koi scan nahi kiya gaya</p>';
      return;
    }

    container.innerHTML = '';
    history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs';
      
      const badgeColor = item.gi <= 55 
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : item.gi <= 69 
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <img src="${item.thumb}" class="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700" alt="">
          <div class="truncate">
            <p class="font-semibold text-white truncate">${item.name}</p>
            <p class="text-[10px] text-slate-400">${item.time}</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full font-bold border ${badgeColor} shrink-0">
          GI ${item.gi}
        </span>
      `;
      container.appendChild(row);
    });
  } catch (e) {
    console.warn("History load error:", e);
  }
}

function clearHistory() {
  localStorage.removeItem('food_gi_history');
  loadHistory();
}

// QR Code for Mobile Pairing
function updateQrUrl() {
  // Use current host or local IP
  const url = window.location.href.split('#')[0];
  document.getElementById('qrUrlText').innerText = url;

  const qrContainer = document.getElementById('qrcode');
  if (qrContainer && window.QRCode) {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: url,
      width: 190,
      height: 190,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

function openQrModal() {
  updateQrUrl();
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}
