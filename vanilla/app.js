const HardwareController = {
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
      
      // TODO: Integrate scanner library (e.g., jsQR / html5-qrcode) for active frame decoding
      console.log("Camera stream active, waiting for decoder interface...");
    } catch (err) {
      alert("Camera access denied!");
    }
  },

  // Web Bluetooth GATT connection demo
  async checkBluetooth() {
    const btn = document.getElementById('btnBluetooth');
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      const server = await device.gatt.connect();
      btn.classList.add('success');
      alert("Connected to: " + device.name);
      // TODO: Implement GATT characteristic write/read protocol if required
    } catch (err) {
      console.log("Bluetooth pairing cancelled");
    }
  },

  // Geolocation API check
  checkGPS() {
    const btn = document.getElementById('btnGPS');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        btn.classList.add('success');
        alert(`Location lock acquired: ${lat}, ${lng}`);
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
  await fetchAvailableDaysFromAPI();
  renderDays(); 
  await loadMealsForDate(selectedDate);
  prefetchUpcomingDays();
}

// Fetch and filter operating days from OpenMensa REST API
async function fetchAvailableDaysFromAPI() {
  if (!canteenId) return;
  try {
    isLoading = true;
    renderStatus();
    
    const url = new URL(`${canteenId}/days`, API_BASE_URL);
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    
    const daysData = await res.json();
    // Exclude closed days and Sundays
    const openDaysWithoutSundays = daysData.filter(day => {
      if (day.closed === true) return false;
      return new Date(day.date).getDay() !== 0; 
    });
    
    if (openDaysWithoutSundays.length > 0) {
      availableDays = openDaysWithoutSundays;
      if (!selectedDate || !availableDays.some(d => d.date === selectedDate)) {
        selectedDate = availableDays[0].date;
      }
    } else {
      availableDays = [];
      isClosed = true;
    }
  } catch {
    availableDays = [];
    isClosed = true;
  }
}

async function loadMealsForDate(date) {
  if (!date || !canteenId) return;
  try {
    isLoading = true;
    isClosed = false;
    renderStatus();

    const url = new URL(`${canteenId}/days/${date}/meals`, API_BASE_URL);
    const res = await fetch(url);
    if (!res.ok) { meals = []; isClosed = true; return; }
    
    meals = await res.json();
    if (meals.length === 0) isClosed = true;
  } catch { 
    meals = []; 
    isClosed = true; 
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
  if (isClosed) return;

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
  } else if (isClosed || availableDays.length === 0) {
    nodes.mealsList.classList.remove('state-loading');
    nodes.statusDiv.innerHTML = '<p style="color: #c53030; text-align:center; font-weight:500; margin-top:20px;">Aktuell sind keine geöffneten Tage für diese Mensa hinterlegt.</p>';
    nodes.mealsList.innerHTML = '';
  } else {
    nodes.mealsList.classList.remove('state-loading');
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

  // fetch upcoming day expect the current one
  const daysToPrefetch = availableDays.filter(day => day.date !== selectedDate);

  console.log(`[Prefetch] Start background download for ${daysToPrefetch.length} days...`);

  daysToPrefetch.forEach(day => {
    const url = new URL(`${canteenId}/days/${day.date}/meals`, API_BASE_URL);
    
    fetch(url)
      .then(res => {
        if (res.ok) {
          console.log(`[Prefetch] succefully saved in cache: ${day.date}`);
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