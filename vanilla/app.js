// ============================================================================
// 1. HARDWARE CONTROLLER (Kamera, GPS, Bluetooth, Web NFC, Debug-Panel)
// ============================================================================
const HardwareController = {
  qrScanActive: false,
  qrCanvas: null,
  eventLog: [],

  // 📋 DEBUG LOG PANEL
  ensureLogPanel() {
    let panel = document.getElementById('hc-log-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'hc-log-panel';
      panel.style.cssText = `
        position: fixed; bottom: 16px; right: 16px; width: 280px; max-height: 180px;
        overflow-y: auto; background: rgba(20, 20, 20, 0.92); color: #81e6d9;
        font-family: monospace; font-size: 0.72rem; padding: 8px; border-radius: 8px;
        z-index: 9998; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(panel);
    }
    return panel;
  },

  logEvent(message) {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${message}`;
    this.eventLog.push(entry);
    console.log(entry);

    const panel = this.ensureLogPanel();
    const line = document.createElement('div');
    line.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    line.style.padding = '2px 0';
    line.textContent = entry;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  },

  toggleLogPanel() {
    const panel = this.ensureLogPanel();
    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'block' : 'none';
    this.showToast(isHidden ? "🐞 Debug Panel aktiv" : "🙈 Debug Panel verdeckt", "info", 1500);
  },

  async copyLogToClipboard() {
    if (this.eventLog.length === 0) {
      this.showToast("Log ist noch leer.", "info");
      return;
    }
    const text = this.eventLog.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showToast('📋 Log kopiert! Bereit zum Einfügen.', 'success', 3000);
    } catch (e) {
      this.showToast('Fehler beim Kopieren des Logs.', 'error');
    }
  },

  getPlatformInfo() {
    const ua = navigator.userAgent;
    let os = "Unknown OS";
    let browser = "Unknown Browser";

    if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Macintosh/i.test(ua)) os = "macOS";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Linux/i.test(ua)) os = "Linux";

    if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
    else if (/Edg/i.test(ua)) browser = "Edge";

    return { os, browser };
  },

  ensureToastContainer() {
    let container = document.getElementById('hc-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hc-toast-container';
      container.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 9999; display: flex; flex-direction: column; gap: 8px;
        align-items: center; pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    return container;
  },

  showToast(message, type = 'info', duration = 4000) {
    const container = this.ensureToastContainer();
    const toast = document.createElement('div');

    const colors = {
      success: { bg: '#f0fff4', border: '#9ae6b4', text: '#22543d' },
      error:   { bg: '#fff5f5', border: '#feb2b2', text: '#822727' },
      info:    { bg: '#ebf8ff', border: '#90cdf4', text: '#2a4365' }
    };
    const c = colors[type] || colors.info;

    toast.style.cssText = `
      background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
      padding: 10px 16px; border-radius: 8px; font-family: sans-serif; font-size: 0.9rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 90vw; text-align: center;
      pointer-events: auto; opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease;
      transform: translateY(-8px); white-space: pre-line;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  showHardwareError(title, systemInfo, reason) {
    this.logEvent(`ERROR: ${title} — ${reason}`);
    this.showToast(`⚠️ ${title}\n${systemInfo.browser} auf ${systemInfo.os}\n${reason}`, 'error', 5000);
  },

  // 📷 KAMERA & QR SCANNER
  async checkCamera() {
    const info = this.getPlatformInfo();
    const video = document.getElementById('cameraStream');
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');

    this.logEvent(`Kamera-Test gestartet (${info.browser} / ${info.os})`);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showHardwareError("Kamera nicht unterstützt", info, "MediaDevices API fehlt in diesem Browser.");
      return;
    }

    try {
      const isMobile = info.os === "iOS" || info.os === "Android";
      let stream;

      if (isMobile) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (overlay) overlay.style.display = 'flex';
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
      }
      if (btn) btn.classList.add('success');

      this.logEvent("Kamera gestartet");
      this.qrScanActive = true;
      requestAnimationFrame(this.scanQRCode.bind(this));

    } catch (err) {
      this.showHardwareError("Kamera-Zugriff verweigert", info, err.message || err);
    }
  },

  scanQRCode() {
    if (!this.qrScanActive) return;

    const video = document.getElementById('cameraStream');
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!this.qrCanvas) {
        this.qrCanvas = document.createElement('canvas');
      }
      const canvas = this.qrCanvas;
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
          this.logEvent(`QR Code erkannt: ${code.data}`);
          this.showToast(`QR Code erkannt:\n${code.data}`, 'success');
          this.stopCamera();
          return;
        }
      }
    }
    requestAnimationFrame(this.scanQRCode.bind(this));
  },

  stopCamera() {
    this.qrScanActive = false;
    const video = document.getElementById('cameraStream');
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');

    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }

    if (overlay) overlay.style.display = 'none';
    if (btn) btn.classList.remove('success');
    this.logEvent("Kamera gestoppt");
  },

  // 📶 BLUETOOTH
  async checkBluetooth() {
    const info = this.getPlatformInfo();
    const btn = document.getElementById('btnBluetooth');
    this.logEvent(`Bluetooth-Test gestartet (${info.browser} / ${info.os})`);

    if (!navigator.bluetooth) {
      let reason = "Dieser Browser unterstützt die Web Bluetooth API nicht.";
      if (info.os === "iOS") reason = "Apple blockiert Web Bluetooth in allen iOS-Browsern.";
      else if (info.browser === "Safari") reason = "Safari unterstützt kein Web Bluetooth (nutze Chrome/Edge).";
      else if (info.browser === "Firefox") reason = "Firefox hat Web Bluetooth deaktiviert.";

      this.showHardwareError("Bluetooth nicht verfügbar", info, reason);
      return;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      await device.gatt.connect();

      if (btn) btn.classList.add('success');
      this.logEvent(`Bluetooth verbunden: ${device.name || 'Unbenannt'}`);
      this.showToast(`✅ Verbunden mit "${device.name || 'Unbenannt'}"`, 'success');
      setTimeout(() => btn && btn.classList.remove('success'), 3000);

    } catch (err) {
      if (err.name === 'NotFoundError' || (err.message && err.message.includes('cancelled'))) {
        this.logEvent("Bluetooth Koppelung abgebrochen");
        return;
      }
      this.showHardwareError("Bluetooth Verbindung fehlgeschlagen", info, err.message || err);
    }
  },

  // 📍 GPS / GEOLOCATION
  checkGPS() {
    const info = this.getPlatformInfo();
    const btn = document.getElementById('btnGPS');
    this.logEvent(`GPS-Abfrage gestartet (${info.browser} / ${info.os})`);

    if (!navigator.geolocation) {
      this.showHardwareError("GPS nicht unterstützt", info, "Geolocation API fehlt.");
      return;
    }

    const isMobile = info.os === "iOS" || info.os === "Android";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);

        if (btn) btn.classList.add('success');
        this.logEvent(`GPS empfangen: Lat ${lat}, Lng ${lng}`);
        this.showToast(`📍 Position ermittelt!\nLat: ${lat}, Lng: ${lng}`, 'success');
        setTimeout(() => btn && btn.classList.remove('success'), 3000);
      },
      (err) => {
        let reason = "Unbekannter Fehler bei Standortabfrage.";
        if (err.code === 1) reason = "Standortzugriff im Browser oder OS verweigert.";
        if (err.code === 2) reason = "Position nicht verfügbar (kein GPS-Empfang).";
        if (err.code === 3) reason = "Zeitüberschreitung beim Abrufen des Standorts.";

        this.showHardwareError("Standort-Fehler", info, reason);
      },
      { timeout: 10000, enableHighAccuracy: isMobile }
    );
  },

  // 🏷️ WEB NFC
  async checkNFC() {
    const info = this.getPlatformInfo();
    this.logEvent(`NFC-Test gestartet (${info.browser} / ${info.os})`);

    if (!('NDEFReader' in window)) {
      let reason = "Web NFC wird nur von Chrome auf Android unterstützt.";
      if (info.os === "iOS") reason = "Apple blockiert Web NFC in allen iOS-Browsern vollständig.";
      else if (info.os === "Windows" || info.os === "macOS" || info.os === "Linux") {
        reason = "Desktop-Betriebssysteme haben keine NFC-Schnittstelle im Browser.";
      }

      this.showHardwareError("NFC Nicht Unterstützt", info, reason);
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();

      this.logEvent("NFC-Scan aktiv — warte auf Tag...");
      this.showToast("NFC-Scan aktiv — halte einen NFC-Tag an dein Smartphone.", 'info');

      ndef.addEventListener("readingerror", () => {
        this.showHardwareError("NFC Lesefehler", info, "Tag erkannt, aber Auslesen fehlgeschlagen.");
      });

      ndef.addEventListener("reading", ({ serialNumber }) => {
        this.logEvent(`NFC Tag gelesen: ${serialNumber}`);
        this.showToast(`NFC Tag gelesen!\nSeriennummer: ${serialNumber}`, 'success');
      });

    } catch (error) {
      this.showHardwareError("NFC Fehler", info, error.message || error);
    }
  },

  simulateNFCScan() {
    this.logEvent("SIMULIERTER NFC Scan gestartet");
    this.showToast("⚠️ Simulierter Scan...", 'info', 1500);

    setTimeout(() => {
      const fakeSerial = "04:A2:B1:" + Math.floor(1000 + Math.random() * 9000);
      this.logEvent(`SIMULIERTER Tag gelesen: ${fakeSerial}`);
      this.showToast(`NFC Tag gelesen! (simuliert)\nSeriennummer: ${fakeSerial}`, 'success');
    }, 1000);
  }
};

// ============================================================================
// 2. STUWE ICON MAPPER & HELPER
// ============================================================================
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

// ============================================================================
// 3. GLOBAL STATE & CANTEEN DATASET
// ============================================================================
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
let nodes = {}; 
let map = null;

const API_BASE_URL = 'https://openmensa.org/api/v2/canteens/';

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
      hours: "Aktuell geschlossen", 
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

// ============================================================================
// 4. MENSA LOGIK & DOM RENDERING
// ============================================================================

function initMap(lat, lng, name) {
  const mapElement = document.getElementById('map');
  if (!mapElement || typeof L === 'undefined') return;

  if (map) { map.remove(); }

  map = L.map('map').setView([lat, lng], 16);

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
  }).addTo(map);

  L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
}

function toggleDropdown(id) {
  const target = document.getElementById(id);
  if (!target) return;
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
  const dropdown = document.getElementById('categoryDropdown');
  if (dropdown) dropdown.classList.remove('offen');
}

function resetFilters() {
  document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
  activeFilterKeywords = [];
  renderMeals();
  const dropdown = document.getElementById('categoryDropdown');
  if (dropdown) dropdown.classList.remove('offen');
}

// ABSTURZSICHERE EVENT-LISTENER
function initEventListeners() {
  document.getElementById('menuOpenTrigger')?.addEventListener('click', toggleMenu);
  document.getElementById('menuCloseTrigger')?.addEventListener('click', toggleMenu);
  nodes.menuOverlay?.addEventListener('click', toggleMenu);

  nodes.headerCanteenTrigger?.addEventListener('click', toggleInlineDropdown);
  nodes.dropdownSchliesser?.addEventListener('click', toggleInlineDropdown);

  document.getElementById('carouselPrev')?.addEventListener('click', () => scrollCarousel(-1));
  document.getElementById('carouselNext')?.addEventListener('click', () => scrollCarousel(1));

  nodes.citySelect?.addEventListener('change', (e) => {
    currentUniKey = e.target.value;
    canteenId = universityCanteens[currentUniKey][0].id; 
    updatePageHeader();
    updateCanteenDropdown(currentUniKey);
    resetMealsAndReload();
    toggleMenu(); 
  });

  nodes.inlineDropdown?.addEventListener('click', (e) => {
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
  if (nodes.citySelect) nodes.citySelect.value = 'tuebingen';
  canteenId = universityCanteens['tuebingen'][0].id;
  
  updatePageHeader();
  updateCanteenDropdown('tuebingen');
  resetMealsAndReload();
}

function toggleMenu() {
  nodes.appSidebar?.classList.toggle('offen');
  nodes.menuOverlay?.classList.toggle('offen');
}

function toggleInlineDropdown() {
  nodes.inlineDropdown?.classList.toggle('offen');
  nodes.dropdownSchliesser?.classList.toggle('offen');
  nodes.headerCanteenTrigger?.classList.toggle('aktiv');
}

function scrollCarousel(direction) {
  const container = nodes.dayCarousel;
  if (!container) return;
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
  if (nodes.citySelect && nodes.citySelect.options && nodes.citySelect.options[nodes.citySelect.selectedIndex]) {
    if (nodes.headerUniversityTitle) {
      nodes.headerUniversityTitle.textContent = nodes.citySelect.options[nodes.citySelect.selectedIndex].text;
    }
  }
  
  const currentCanteen = universityCanteens[currentUniKey]?.find(c => c.id == canteenId);
  if (currentCanteen) {
    if (nodes.headerCanteenTitle) nodes.headerCanteenTitle.textContent = currentCanteen.name;
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
  if (!nodes.inlineDropdown) return;
  const fragment = document.createDocumentFragment();
  nodes.inlineDropdown.innerHTML = '';
  
  if (universityCanteens[uniKey]) {
    universityCanteens[uniKey]
      .filter(c => c.id != canteenId)
      .forEach(c => {
        const item = document.createElement('div');
        item.className = 'inline-dropdown-item';
        item.textContent = c.name;
        item.dataset.canteenId = c.id;
        fragment.appendChild(item);
      });
  }
    
  nodes.inlineDropdown.appendChild(fragment);
}

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

function getTwoWeeksDays() {
  const days = [];
  let current = new Date();
  let count = 0;
  
  while (count < 10) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      days.push({ 
        date: `${yyyy}-${mm}-${dd}`,
        closed: false 
      });
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return days; 
}

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
  if (!nodes.dayCarousel) return;
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

function renderSelectedDayTitle() {
  if (!nodes.selectedDayTitle) return;
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
  if (!nodes.mealsList) return;
  nodes.mealsList.innerHTML = '';
  if (isClosed || (isOfflineError && meals.length === 0) || hasNoData) return;

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
    
    const priceVal = activePriceType === 'students' 
      ? meal.prices.students 
      : (meal.prices.employees || meal.prices.others || meal.prices.pupils);

    const formattedPrice = priceVal ? `${priceVal.toFixed(2).replace('.', ',')} €` : 'N/A';
    
    const cleanNotes = (meal.notes || []).filter(note => {
      const n = note.toLowerCase();
      return !n.includes('[vegan]') && !n.includes('[v]') && !n.includes('vegetarisch');
    });

    const hasNotes = cleanNotes.length > 0;
    const uniqueId = `allergens-${index}`;
    let allergenHtml = '';
    let toggleBtn = '';

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
  if (!nodes.statusDiv || !nodes.mealsList) return;

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
  if (!liste) return;
  liste.classList.toggle('offen');
  if (btn) btn.classList.toggle('offen');
}

function prefetchUpcomingDays() {
  if (!availableDays || availableDays.length <= 1 || !canteenId) return;
  const daysToPrefetch = availableDays.filter(day => day.date !== selectedDate);

  daysToPrefetch.forEach(day => {
    const url = new URL(`${canteenId}/days/${day.date}/meals`, API_BASE_URL);
    fetch(url).catch(() => {});
  });
}

function render() {
  renderStatus();
  renderSelectedDayTitle(); 
  renderMeals();
}

// ============================================================================
// 5. INITIALISIERUNG
// ============================================================================
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
  };

  initEventListeners();
  setupInitialState();

  // Schließt Filter-Dropdowns bei Klick außerhalb
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown-container')) {
      document.querySelectorAll('.filter-dropdown-container').forEach(el => el.classList.remove('offen'));
    }
  });

  // HardwareController Log-Eintrag zum Start
  const sys = HardwareController.getPlatformInfo();
  HardwareController.logEvent(`App erfolgreich gestartet auf ${sys.browser} / ${sys.os}`);
});