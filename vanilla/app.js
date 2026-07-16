const HardwareController = {
  qrScanActive: false,

  // Camera check & stream initialization
  async checkCamera() {
    const video = document.getElementById('cameraStream');
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      overlay.style.display = 'flex';
      video.srcObject = stream;
      btn.classList.add('success');
      
      video.setAttribute("playsinline", true); // Required for iOS Safari
      video.play();
      
      this.qrScanActive = true;
      requestAnimationFrame(this.scanQRCode.bind(this));
    } catch (err) {
      alert("Camera access denied!");
    }
  },

  // Actively analyze video frames for QR codes using the jsQR library
  scanQRCode() {
    if (!this.qrScanActive) return;

    const video = document.getElementById('cameraStream');
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      let canvas = document.getElementById('qrCanvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'qrCanvas';
      }
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        
        if (code) {
          if (navigator.vibrate) navigator.vibrate(100);
          alert("QR Code Detected: " + code.data);
          this.stopCamera();
          return;
        }
      } else {
        console.warn("jsQR library is not loaded. Ensure the CDN script is placed in your HTML.");
      }
    }
    requestAnimationFrame(this.scanQRCode.bind(this));
  },

  // Stop camera tracks and terminate QR processing
  stopCamera() {
    this.qrScanActive = false;
    const video = document.getElementById('cameraStream');
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');
    
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    overlay.style.display = 'none';
    btn.classList.remove('success');  
  },

  // Bluetooth GATT connection check with fallback alert for iOS
  async checkBluetooth() {
    const btn = document.getElementById('btnBluetooth');
    
    if (!navigator.bluetooth) {
      alert("Web Bluetooth is not supported on iOS Safari (iPhone). Please test using Chrome on Android or Desktop.");
      return;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      const server = await device.gatt.connect();
      
      // 1. Turn button green
      btn.classList.add('success');
      
      // 2. Show alert after rendering
      setTimeout(() => {
        alert("Connected to: " + device.name);
        // 3. Remove green after user clicks "OK"
        btn.classList.remove('success');
      }, 100);

    } catch (err) {
      console.log("Bluetooth pairing cancelled");
    }
  },

  // Get user coordinates via Geolocation API
  checkGPS() {
    const btn = document.getElementById('btnGPS');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        
        // 1. Turn button green
        btn.classList.add('success');
        
        // 2. Wait a tiny bit so the green renders, then show alert
        setTimeout(() => {
          alert(`Location lock acquired: ${lat}, ${lng}`);
          // 3. Remove green immediately after user clicks "OK"
          btn.classList.remove('success');
        }, 100);

      }, (err) => {
        alert("Location data unavailable.");
      });
    }
  },

  // Web NFC Reader (Chrome on Android only)
  async checkNFC() {
    if (!('NDEFReader' in window)) {
      alert("Web NFC not supported by this browser/OS. (Note: iOS Safari blocks Web NFC; test with Chrome on Android).");
      return;
    }

    try {
      const ndef = new NDEFReader();
      alert("NFC polling active. Place an RFID/NFC tag (e.g., student ID, canteen card) against the back of your device.");
      
      await ndef.scan();
      console.log("NFC scan session started successfully.");

      ndef.addEventListener("readingerror", () => {
        alert("NFC tag detected, but reading failed. Try again.");
      });

      ndef.addEventListener("reading", ({ message, serialNumber }) => {
        alert(`NFC Read Success!\nCard Detected!\nSerial: ${serialNumber}`);
        console.log(`NFC Tag UID: ${serialNumber}`);
      });

    } catch (error) {
      console.error("NFC operation failed:", error);
      alert(`NFC Error: ${error.message || error}`);
    }
  },

  // Terminate active video tracks to release hardware locks
  stopCamera() {
    const video = document.getElementById('cameraStream');
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');
    
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    overlay.style.display = 'none';
    btn.classList.remove('success');  
  },
};

// Map STUWE keywords to local assets
const STUWE_ICON_BASE = "images/"; 
const stuweIconMap = {
  "empfehlung": "icon_empfehlungs_des_kuechenchefs.png.webp",
  "fisch": "icon_fisch.png.webp",
  "geflügel": "icon_gefluegel.png.webp",
  "kalb": "icon_kalb.png.webp",
  "lamm":"icon_lamm.png.webp",
  "rind": "icon_rind.png.webp",
  "schwein": "icon_schwein.png.webp",
  "vegan": "icon_vegan.png.webp",
  "vegetarisch": "icon_vegetarisch.png.webp",
  "wild": "icon_wild.png.webp"
};

// Parse meal attributes to append matching diet/allergen badges
function getStuweIconHtml(meal) {
  if (!meal) return '';

  const textToSearch = [
    meal.name,
    meal.category,
    ...(meal.notes || []) 
  ].join(' ').toLowerCase();

  let foundIcons = '';

  for (const key in stuweIconMap) {
    if (textToSearch.includes(key.toLowerCase())) {
      const iconUrl = `${STUWE_ICON_BASE}${stuweIconMap[key]}`;
      foundIcons += `<img src="${iconUrl}" alt="${key}" title="${key}" class="diet-icon icon-hover">`;
    }
  }
  return foundIcons;
}

// Global State & Configuration
let meals = [];
let isLoading = true;
let isClosed = false;
let isOfflineError = false; 
let hasNoData = false;       
let availableDays = [];
let selectedDate = '';
let canteenId = '';
let currentUniKey = 'tuebingen';
let activePriceType = 'students'; 
let activeFilterKeywords = [];
let nodes = {}; // Cached DOM references

const API_BASE_URL = 'https://openmensa.org/api/v2/canteens/';

// Canteen static dataset (coordinates, hours, and navigation endpoints)
const universityCanteens = {
  tuebingen: [
    { 
      id: 1771, 
      name: "Mensa Wilhelmstraße", 
      lat: 48.5238, lng: 9.0567,
      hours: "Mo - Fr: 11:15 - 14:00 Uhr (Essensausgabe)", 
      address: "Wilhelmstraße 13, 72074 Tübingen", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Wilhelmstraße+Tübingen" 
    },
    { 
      id: 1766, 
      name: "Mensa Morgenstelle", 
      lat: 48.5365, lng: 9.0347,
      hours: "Mo - Fr: 11:30 - 14:00 Uhr", 
      address: "Auf der Morgenstelle 26, 72076 Tübingen", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Morgenstelle+Tübingen" 
    },
    { 
      id: 1768, 
      name: "Mensa Prinz Karl", 
      lat: 48.5211, lng: 9.0572,
      hours: "Aktuell geschlossen ❌", 
      address: "Hafengasse 6, 72070 Tübingen", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Prinz+Karl+Tübingen" 
    },
    { 
      id: 1763, 
      name: "Cafeteria Morgenstelle", 
      lat: 48.5365, lng: 9.0347,
      hours: "Mo - Fr: 11:00 - 14:30 Uhr (Tagesessen)", 
      address: "Auf der Morgenstelle 26, 72076 Tübingen", 
      url: "https://www.openstreetmap.org/search?query=Cafeteria+Morgenstelle+Tübingen" 
    }
  ],
  uni_stuttgart: [
    { 
      id: 399, 
      name: "Mensa Vaihingen", 
      lat: 48.7455, lng: 9.1066,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)", 
      address: "Pfaffenwaldring 45, 70569 Stuttgart", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Vaihingen+Stuttgart" 
    },
    { 
      id: 1202, 
      name: "Mensa Central", 
      lat: 48.7824, lng: 9.1729,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)", 
      address: "Ossietzkystraße 3, 70174 Stuttgart", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Central+Stuttgart" 
    }
  ],
  hohenheim: [
    { 
      id: 1765, 
      name: "Mensa Hohenheim", 
      lat: 48.7118, lng: 9.2132,
      hours: "Mo - Fr: 11:00 - 14:00 Uhr", 
      address: "Garbenstraße 13, 70599 Stuttgart", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Hohenheim" 
    }
  ],
  esslingen: [
    { 
      id: 1771, 
      name: "Mensa Esslingen Stadtmitte", 
      lat: 48.7381, lng: 9.3113,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)", 
      address: "Kanalstraße 33, 73728 Esslingen", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Kanalstraße+Esslingen" 
    },
    { 
      id: 1772, 
      name: "Mensa Esslingen Flandernstraße", 
      lat: 48.7483, lng: 9.3226,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)", 
      address: "Flandernstraße 101, 73732 Esslingen", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Flandernstraße+Esslingen" 
    }
  ],
  nuertingen: [
    { 
      id: 1767, 
      name: "Mensa Nürtingen", 
      lat: 48.6276, lng: 9.3361,
      hours: "Mo - Fr: 11:00 - 14:00 Uhr", 
      address: "Heiligkreuzstraße 15, 72622 Nürtingen", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Nürtingen" 
    }
  ],
  karlsruhe: [
    { 
      id: 1618, 
      name: "Mensa Am Adenauerring (KIT)", 
      lat: 49.0118, lng: 8.4170,
      hours: "Mo - Fr: 11:00 - 14:00 Uhr", 
      address: "Adenauerring 7, 76131 Karlsruhe", 
      url: "https://www.openstreetmap.org/search?query=Mensa+am+Adenauerring+Karlsruhe" 
    },
    { 
      id: 1621, 
      name: "Mensa Moltkestraße", 
      lat: 49.0159, lng: 8.3905,
      hours: "Mo - Fr: 11:15 - 14:00 Uhr", 
      address: "Moltkestraße 30, 76133 Karlsruhe", 
      url: "https://www.openstreetmap.org/search?query=Mensa+Moltkestraße+Karlsruhe" 
    }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  nodes = {
    citySelect: document.getElementById('citySelect'),
    dayCarousel: document.getElementById('dayCarousel'),
    mealsList: document.getElementById('mealsList'),
    statusDiv: document.getElementById('status'),
    headerUniversityTitle: document.getElementById('headerUniversityTitle'),
    headerCanteenTitle: document.getElementById('headerCanteenTitle'),
    inlineDropdown: document.getElementById('inlineDropdown'),
    appSidebar: document.getElementById('appSidebar'),
    menuOverlay: document.getElementById('menuOverlay'),
    dropdownSchliesser: document.getElementById('dropdownCloser'), 
    headerCanteenTrigger: document.getElementById('headerCanteenTrigger'),
    selectedDayTitle: document.getElementById('selectedDayTitle'),
    infoHours: document.getElementById('infoHours'),
    infoCanteenName: document.getElementById('infoCanteenName'),
    infoAddress: document.getElementById('infoAddress'),
    infoMapButton: document.getElementById('infoMapButton')
  } 

  initEventListeners();
  setupInitialState();
  
  // Close active dropdowns on backdrop click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown-container')) {
      document.querySelectorAll('.filter-dropdown-container').forEach(el => el.classList.remove('offen'));
    }
  });
});

let map = null;

// Leaflet map setup and positioning
function initMap(lat, lng, name) {
    if (map) { map.remove(); }

    map = L.map('map').setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
}

function toggleDropdown(id) {
  const target = document.getElementById(id);
  const warOffen = target.classList.contains('offen');
  document.querySelectorAll('.filter-dropdown-container').forEach(el => el.classList.remove('offen'));
  if (!warOffen) target.classList.add('offen');
}

function changePriceType(type) {
  activePriceType = type;
  renderMeals();
}

function applyFilters() {
  activeFilterKeywords = [];
  document.querySelectorAll('.filter-checkbox:checked').forEach(cb => {
    activeFilterKeywords.push(cb.value.toLowerCase());
  });
  renderMeals();
  document.getElementById('categoryDropdown').classList.remove('offen');
}

function resetFilters() {
  document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
  activeFilterKeywords = [];
  renderMeals();
  document.getElementById('categoryDropdown').classList.remove('offen');
}

function initEventListeners() {
  document.getElementById('menuOpenTrigger').addEventListener('click', toggleMenu);
  document.getElementById('menuCloseTrigger').addEventListener('click', toggleMenu);
  nodes.menuOverlay.addEventListener('click', toggleMenu);

  nodes.headerCanteenTrigger.addEventListener('click', toggleInlineDropdown);
  nodes.dropdownSchliesser.addEventListener('click', toggleInlineDropdown);

  document.getElementById('carouselPrev').addEventListener('click', () => scrollCarousel(-1));
  document.getElementById('carouselNext').addEventListener('click', () => scrollCarousel(1));

  nodes.citySelect.addEventListener('change', (e) => {
    currentUniKey = e.target.value;
    canteenId = universityCanteens[currentUniKey][0].id; 
    updatePageHeader();
    updateCanteenDropdown(currentUniKey);
    resetMealsAndReload();
    toggleMenu(); 
  });

  nodes.inlineDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.inline-dropdown-item');
    if (!item) return;
    
    canteenId = item.dataset.canteenId;
    updatePageHeader();
    updateCanteenDropdown(currentUniKey); 
    resetMealsAndReload();
    toggleInlineDropdown();
  });
}

function setupInitialState() {
  nodes.citySelect.value = 'tuebingen';
  canteenId = universityCanteens['tuebingen'][0].id;
  
  updatePageHeader();
  updateCanteenDropdown('tuebingen');
  resetMealsAndReload();
}

function toggleMenu() {
  nodes.appSidebar.classList.toggle('offen');
  nodes.menuOverlay.classList.toggle('offen');
}

function toggleInlineDropdown() {
  nodes.inlineDropdown.classList.toggle('offen');
  nodes.dropdownSchliesser.classList.toggle('offen');
  nodes.headerCanteenTrigger.classList.toggle('aktiv');
}

function scrollCarousel(direction) {
  const container = nodes.dayCarousel;
  const firstButton = container.querySelector('.tag-button');
  if (!firstButton) return;

  const width = firstButton.offsetWidth;
  const gap = parseFloat(window.getComputedStyle(container).gap) || 12;
  const scrollAmount = width + gap; 
  
  const currentScroll = container.scrollLeft;
  const targetScroll = Math.round((currentScroll + (scrollAmount * direction)) / scrollAmount) * scrollAmount;
  
  container.scrollTo({ 
    left: targetScroll, 
    behavior: 'smooth' 
  });
}

function updatePageHeader() {
  if (nodes.citySelect && nodes.citySelect.options[nodes.citySelect.selectedIndex]) {
    nodes.headerUniversityTitle.textContent = nodes.citySelect.options[nodes.citySelect.selectedIndex].text;
  }
  
  const currentCanteen = universityCanteens[currentUniKey].find(c => c.id == canteenId);
  if (currentCanteen) {
    nodes.headerCanteenTitle.textContent = currentCanteen.name;
    
    if (nodes.infoHours) nodes.infoHours.textContent = currentCanteen.hours;
    if (nodes.infoCanteenName) nodes.infoCanteenName.textContent = currentCanteen.name.toUpperCase();
    if (nodes.infoAddress) nodes.infoAddress.textContent = currentCanteen.address;

    if (nodes.infoMapButton) {
      nodes.infoMapButton.onclick = () => {
        window.open(currentCanteen.url, '_blank');
      };
    }
    
    if (currentCanteen.lat && currentCanteen.lng) {
      setTimeout(() => {
        initMap(currentCanteen.lat, currentCanteen.lng, currentCanteen.name);
      }, 100); 
    }
  }
}

function updateCanteenDropdown(uniKey) {
  const fragment = document.createDocumentFragment();
  nodes.inlineDropdown.innerHTML = '';
  
  universityCanteens[uniKey]
    .filter(c => c.id != canteenId)
    .forEach(c => {
      const item = document.createElement('div');
      item.className = 'inline-dropdown-item';
      item.textContent = c.name;
      item.dataset.canteenId = c.id;
      fragment.appendChild(item);
    });
    
  nodes.inlineDropdown.appendChild(fragment);
}

// Clear state and rebuild dataset on user-driven canteen change
async function resetMealsAndReload() {
  meals = [];
  isClosed = false;
  isOfflineError = false;
  hasNoData = false;
  await fetchAvailableDaysFromAPI();
  renderDays(); 
  await loadMealsForDate(selectedDate);
  prefetchUpcomingDays();
}

// Generiert exakt die nächsten 10 Wochentage (ohne Samstage und Sonntage) ab heute
function getTwoWeeksDays() {
  const days = [];
  let current = new Date();
  
  let count = 0;
  // Wir wollen genau 10 gültige Wochentage (Mo-Fr) im Karussell
  while (count < 10) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Weder Sonntag (0) noch Samstag (6)
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      days.push({ 
        date: `${yyyy}-${mm}-${dd}`,
        closed: false // Standardmäßig offen, API-Daten überschreiben das bei Bedarf
      });
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return days; 
}

// Fetch and filter operating days from OpenMensa REST API
async function fetchAvailableDaysFromAPI() {
  if (!canteenId) return;
  
  availableDays = getTwoWeeksDays();
  if (!selectedDate || !availableDays.some(d => d.date === selectedDate)) {
    selectedDate = availableDays[0].date;
  }

  try {
    isLoading = true;
    isOfflineError = false;
    hasNoData = false;
    renderStatus();
    
    const url = new URL(`${canteenId}/days`, API_BASE_URL);
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    
    const daysData = await res.json();
    
    availableDays.forEach(day => {
      const apiDay = daysData.find(d => d.date === day.date);
      if (apiDay) {
        day.closed = (apiDay.closed === true);
      }
    });

  } catch (err) {
    console.warn("[Offline] Using generated fallback weekdays for the carousel.");
    isOfflineError = true;
  }
}

async function loadMealsForDate(date) {
  if (!date || !canteenId) return;
  try {
    isLoading = true;
    isClosed = false;
    isOfflineError = false;
    hasNoData = false;
    renderStatus();

    const url = new URL(`${canteenId}/days/${date}/meals`, API_BASE_URL);
    const res = await fetch(url);
    
    if (!res.ok) { 
      meals = []; 
      
      const dayMeta = availableDays.find(d => d.date === date);
      if (dayMeta && dayMeta.closed) {
        isClosed = true;
      } else {
        hasNoData = true;
      }
      return; 
    }
    
    meals = await res.json();
    
    if (meals.length === 0) {
      const dayMeta = availableDays.find(d => d.date === date);
      if (dayMeta && dayMeta.closed) {
        isClosed = true;
      } else {
        hasNoData = true;
      }
    }
  } catch { 
    meals = []; 
    isOfflineError = true; 
  } finally { 
    isLoading = false; 
    render(); 
  }
}

function renderDays() {
  const fragment = document.createDocumentFragment();
  nodes.dayCarousel.innerHTML = '';
  if (availableDays.length === 0) return;

  availableDays.forEach(day => {
    const d = new Date(day.date);
    const wochentage = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    const dayName = wochentage[d.getDay()];
    const dateStr = `${d.getDate()}.${d.getMonth() + 1}.`;

    const btn = document.createElement('button');
    btn.className = 'tag-button';
    if (day.date === selectedDate) btn.classList.add('tag-aktiv');
    
    btn.innerHTML = `
      <span class="day-name">${dayName}</span>
      <span class="day-date">${dateStr}</span>
    `;

    btn.addEventListener('click', async () => {
      if (selectedDate === day.date) return; 
      selectedDate = day.date;
      
      nodes.dayCarousel.querySelectorAll('.tag-button').forEach(b => b.classList.remove('tag-aktiv'));
      btn.classList.add('tag-aktiv');
      await loadMealsForDate(day.date);
    });
    fragment.appendChild(btn);
  });
  
  nodes.dayCarousel.appendChild(fragment);
}

// Convert ISO date (YYYY-MM-DD) to localized weekday string
function renderSelectedDayTitle() {
  if (!selectedDate) {
    nodes.selectedDayTitle.textContent = '';
    return;
  }
  const parts = selectedDate.split('-'); 
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const wochentageLang = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    
    const dayName = wochentageLang[d.getDay()];
    const dateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
    
    nodes.selectedDayTitle.textContent = `${dayName}  ${dateStr}`;
  } else {
    nodes.selectedDayTitle.textContent = selectedDate;
  }
}

function renderMeals() {
  nodes.mealsList.innerHTML = '';
  if (isClosed || isOfflineError && meals.length === 0 || hasNoData) return;

  // Client-side fuzzy keyword filtering
  const filteredMeals = meals.filter(meal => {
    if (activeFilterKeywords.length === 0) return true;
    const mealText = [meal.name, meal.category, ...(meal.notes || [])].join(' ').toLowerCase();
    return activeFilterKeywords.some(keyword => mealText.includes(keyword));
  });

  if (filteredMeals.length === 0 && meals.length > 0) {
    nodes.mealsList.innerHTML = '<p style="color:#7f8c8d; text-align:center; font-family:Futura,sans-serif; margin-top:24px;">Keine Gerichte entsprechen den Filterkriterien.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredMeals.forEach((meal, index) => {
    const div = document.createElement('div');
    div.className = 'gericht-karte';
    
    // Resolve group price (Fallback to guest/others)
    const priceVal = activePriceType === 'students' 
      ? meal.prices.students 
      : (meal.prices.employees || meal.prices.others || meal.prices.pupils);

    const formattedPrice = priceVal ? `${priceVal.toFixed(2).replace('.', ',')} €` : 'N/A';
    
    // Filter redundant diet labels from OpenMensa notes array
    const cleanNotes = (meal.notes || []).filter(note => {
      const n = note.toLowerCase();
      return !n.includes('[vegan]') && !n.includes('[v]') && !n.includes('vegetarisch');
    });

    const hasNotes = cleanNotes.length > 0;
    const uniqueId = `allergens-${index}`;
    let allergenHtml = '';
    let toggleBtn = '';

    // Inject collapsible allergen drawer
    if (hasNotes) {
      const notesContent = cleanNotes.some(n => n.toLowerCase().includes('allergene'))
        ? cleanNotes.map(n => `<div class="notes-line">${n}</div>`).join('')
        : `<div class="notes-line"><b>Infos/Allergene:</b> ${cleanNotes.join(', ')}</div>`;

      allergenHtml = `<div class="meal-notes" id="${uniqueId}">${notesContent}</div>`;
      toggleBtn = `<button class="toggle-details-btn" onclick="toggleAllergene('${uniqueId}', this)">▼</button>`;
    }

    div.innerHTML = `
      <div class="gericht-kategorie" style="margin-bottom: 4px;">${meal.category}</div>
      <div class="gericht-header">
        <div class="gericht-name">
          ${getStuweIconHtml(meal)} ${meal.name}
        </div>
        <div class="preis-container">
            <div class="gericht-preis">${formattedPrice}</div>
            ${toggleBtn}
        </div>
      </div>
      ${allergenHtml}
    `;
    fragment.appendChild(div);
  });
  
  nodes.mealsList.appendChild(fragment);
}

function renderStatus() {
  if (isLoading) {
    nodes.mealsList.classList.add('state-loading');
    nodes.statusDiv.innerHTML = ''; 
    return;
  }
  
  nodes.mealsList.classList.remove('state-loading');
  
  if (isOfflineError) {
    if (meals.length === 0) {
      nodes.statusDiv.innerHTML = `
        <div class="offline-warning" style="text-align:center; padding: 24px; font-family:Futura,sans-serif; background: #fffaf0; border: 1px solid #feebc8; border-radius: 8px; margin: 20px auto; max-width: 90%;">
          <p style="color: #dd6b20; font-weight: bold; margin-bottom: 8px; font-size: 1.1rem;">
            ⚠️ Keine Internetverbindung
          </p>
          <p style="color: #718096; font-size: 0.9rem; line-height: 1.4;">
            Für dieses Datum wurden offline noch keine Daten gespeichert. Bitte gehe online, um den Speiseplan zu laden.
          </p>
        </div>
      `;
      nodes.mealsList.innerHTML = '';
    } else {
      nodes.statusDiv.innerHTML = `
        <div style="text-align:center; margin-bottom: 12px;">
          <span style="background: #edf2f7; color: #4a5568; font-size: 0.8rem; padding: 4px 12px; border-radius: 12px; font-weight: 500; font-family: Futura, sans-serif;">
            ⚡ Offline-Modus (gespeicherte Daten)
          </span>
        </div>
      `;
    }
  } else if (isClosed) {
    nodes.statusDiv.innerHTML = `
      <div style="text-align:center; padding: 24px; font-family:Futura,sans-serif;">
        <p style="color: #c53030; font-weight: bold; font-size: 1.1rem; margin-bottom: 8px;">
          Geschlossen ❌
        </p>
        <p style="color: #718096; font-size: 0.9rem;">
          Diese Mensa hat an dem ausgewählten Tag geschlossen.
        </p>
      </div>
    `;
    nodes.mealsList.innerHTML = '';
  } else if (hasNoData) {
    nodes.statusDiv.innerHTML = `
      <div style="text-align:center; padding: 24px; font-family:Futura,sans-serif; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px auto; max-width: 90%;">
        <p style="color: #4a5568; font-weight: bold; margin-bottom: 8px; font-size: 1.1rem;">
          Kein Speiseplan verfügbar
        </p>
        <p style="color: #718096; font-size: 0.9rem; line-height: 1.4;">
          Für diesen Tag wurden vom Studierendenwerk noch keine Gerichte veröffentlicht.
        </p>
      </div>
    `;
    nodes.mealsList.innerHTML = '';
  } else {
    nodes.statusDiv.innerHTML = '';
  }
}

function toggleAllergene(id, btn) {
  const liste = document.getElementById(id);
  liste.classList.toggle('offen');
  btn.classList.toggle('offen');
}

// Prefetch all other available days in the background to store them in Cache Storage
function prefetchUpcomingDays() {
  if (!availableDays || availableDays.length <= 1 || !canteenId) return;

  const daysToPrefetch = availableDays.filter(day => day.date !== selectedDate);

  console.log(`[Prefetch] Start background download for ${daysToPrefetch.length} days...`);

  daysToPrefetch.forEach(day => {
    const url = new URL(`${canteenId}/days/${day.date}/meals`, API_BASE_URL);
    
    fetch(url)
      .then(res => {
        if (res.ok) {
          console.log(`[Prefetch] successfully saved in cache: ${day.date}`);
        }
      })
      .catch(err => {
        console.warn(`[Prefetch] error for loading: ${day.date}:`, err);
      });
  });
}

function render() {
  renderStatus();
  renderSelectedDayTitle(); 
  renderMeals();
}