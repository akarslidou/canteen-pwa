// ============================================================================
// 1. HARDWARE CONTROLLER (Kamera, GPS, Bluetooth, Web NFC, Debug-Panel)
// ============================================================================
const HardwareController = {
  qrScanActive: false,
  qrCanvas: null,
  eventLog: [],
  qrLastResult: null,
  qrConfirmations: 0,

  logEvent(message) {
    console.log(message);
  },

  getPlatformInfo() {
    const ua = navigator.userAgent;
    let os = "Unbekanntes OS";
    let appInfo = "Unbekannter Browser";

    // OS bestimmen
    if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Macintosh/i.test(ua)) os = "macOS";
    else if (/Windows/i.test(ua)) os = "Windows";

    const isPWA =
      window.navigator.standalone ||
      window.matchMedia("(display-mode: standalone)").matches;

    // System/Engine-Zuordnung
    if (os === "iOS") {
      appInfo = isPWA ? "Home-Bildschirm PWA (WebKit)" : "iOS Browser (WebKit)";
    } else {
      if (/Chrome/i.test(ua))
        appInfo = isPWA ? "Chrome PWA (Blink)" : "Chrome (Blink)";
      else if (/Firefox/i.test(ua)) appInfo = "Firefox (Gecko)";
      else if (/Edg/i.test(ua)) appInfo = "Edge (Blink)";
      else appInfo = "Browser";
    }

    return { os, appInfo };
  },

  showHardwareError(title, info, reason) {
    this.logEvent(`ERROR: ${title} — ${reason}`);
    alert(
      `⚠️ ${title}\n` +
        `System: ${info.os} (${info.appInfo})\n\n` +
        `Grund: ${reason}`,
    );
  },

  // 📷 KAMERA & QR SCANNER
  async checkCamera() {
    const info = this.getPlatformInfo();

    const video = document.getElementById("cameraStream");
    const overlay = document.getElementById("cameraOverlay");
    const btn = document.getElementById("btnCamera");

    if (!video || !overlay || !btn) {
      console.error("Kamera-Elemente wurden nicht gefunden.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showHardwareError(
        "Kamera nicht unterstützt",
        info,
        "Dieser Browser unterstützt keinen Kamerazugriff.",
      );
      return;
    }

    if (typeof jsQR === "undefined") {
      this.showHardwareError(
        "QR Scanner nicht geladen",
        info,
        "Die jsQR-Bibliothek wurde nicht gefunden. Bitte jsQR im HTML einbinden.",
      );
      return;
    }

    try {
      const isMobile = info.os === "iOS" || info.os === "Android";
      let stream;

      if (isMobile) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      overlay.style.display = "flex";
      video.srcObject = stream;

      video.setAttribute("playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.setAttribute("muted", "true");

      await video.play();

      await new Promise((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
        } else {
          video.addEventListener("loadedmetadata", resolve, {
            once: true,
          });
        }
      });

      btn.classList.add("success");
      this.qrScanActive = true;

      requestAnimationFrame(this.scanQRCode.bind(this));
    } catch (err) {
      this.stopCamera();

      this.showHardwareError(
        "Kamerazugriff fehlgeschlagen",
        info,
        "Zugriff verweigert oder keine Kamera gefunden.",
      );
    }
  },

  scanQRCode() {
    if (!this.qrScanActive) return;

    const video = document.getElementById("cameraStream");

    if (!video) {
      requestAnimationFrame(this.scanQRCode.bind(this));
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      requestAnimationFrame(this.scanQRCode.bind(this));
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (!this.qrCanvas) {
        this.qrCanvas = document.createElement("canvas");
      }

      const canvas = this.qrCanvas;
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (typeof jsQR !== "undefined") {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          this.qrScanActive = false;

          let targetUrl = code.data.trim();

          console.log("QR erkannt:", targetUrl);
          this.logEvent(`QR-Code erkannt: ${targetUrl}`);

          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          this.stopCamera();

          if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith("/")) {
            targetUrl = "https://" + targetUrl;
          }

          const qrBanner = document.getElementById("qr-banner");
          const qrBannerText = document.getElementById("qr-banner-text");

          if (qrBanner && qrBannerText) {
            qrBannerText.textContent = `Öffnen: ${targetUrl}`;
            qrBanner.classList.add("aktiv");

            qrBanner.onclick = () => {
              this.hideQRBanner();
              window.location.href = targetUrl;
            };

            if (this.qrBannerTimeout) clearTimeout(this.qrBannerTimeout);
            this.qrBannerTimeout = setTimeout(() => {
              this.hideQRBanner();
            }, 5000);
          } else {
            window.location.href = targetUrl;
          }

          return;
        }
      }
    }

    requestAnimationFrame(this.scanQRCode.bind(this));
  },

  stopCamera() {
    this.qrScanActive = false;

    const video = document.getElementById("cameraStream");
    const overlay = document.getElementById("cameraOverlay");
    const btn = document.getElementById("btnCamera");

    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    if (overlay) {
      overlay.style.display = "none";
    }

    if (btn) {
      btn.classList.remove("success");
    }
  },

  qrBannerTimeout: null,

  hideQRBanner() {
    const qrBanner = document.getElementById("qr-banner");
    if (qrBanner) {
      qrBanner.classList.remove("aktiv");
    }
    if (this.qrBannerTimeout) {
      clearTimeout(this.qrBannerTimeout);
      this.qrBannerTimeout = null;
    }
  },

  // 📶 BLUETOOTH
  async checkBluetooth() {
    const info = this.getPlatformInfo();
    const btn = document.getElementById("btnBluetooth");
    this.logEvent(`Bluetooth-Test gestartet (${info.browser} / ${info.os})`);

    if (!navigator.bluetooth) {
      let reason = "Dieser Browser unterstützt die Web Bluetooth API nicht.";
      if (info.os === "iOS")
        reason = "Apple blockiert Web Bluetooth in allen iOS-Browsern.";
      else if (info.browser === "Safari")
        reason = "Safari unterstützt kein Web Bluetooth (nutze Chrome/Edge).";
      else if (info.browser === "Firefox")
        reason = "Firefox hat Web Bluetooth deaktiviert.";

      this.showHardwareError("Bluetooth nicht verfügbar", info, reason);
      return;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
      });
      await device.gatt.connect();

      if (btn) btn.classList.add("success");
      this.logEvent(`Bluetooth verbunden: ${device.name || "Unbenannt"}`);
      alert(`✅ Verbunden mit "${device.name || "Unbenannt"}"`);
      setTimeout(() => btn && btn.classList.remove("success"), 3000);
    } catch (err) {
      if (
        err.name === "NotFoundError" ||
        (err.message && err.message.includes("cancelled"))
      ) {
        this.logEvent("Bluetooth Koppelung abgebrochen");
        return;
      }
      this.showHardwareError(
        "Bluetooth Verbindung fehlgeschlagen",
        info,
        err.message || err,
      );
    }
  },

  // 📍 GPS / GEOLOCATION
  checkGPS() {
    const info = this.getPlatformInfo();
    const btn = document.getElementById("btnGPS");
    this.logEvent(`GPS-Abfrage gestartet (${info.browser} / ${info.os})`);

    if (!navigator.geolocation) {
      this.showHardwareError(
        "GPS nicht unterstützt",
        info,
        "Geolocation API fehlt.",
      );
      return;
    }

    const isMobile = info.os === "iOS" || info.os === "Android";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);

        if (btn) btn.classList.add("success");
        this.logEvent(`GPS empfangen: Lat ${lat}, Lng ${lng}`);
        alert(`📍 Position ermittelt!\nLat: ${lat}, Lng: ${lng}`);
        setTimeout(() => btn && btn.classList.remove("success"), 3000);
      },
      (err) => {
        let reason = "Unbekannter Fehler bei Standortabfrage.";
        if (err.code === 1)
          reason = "Standortzugriff im Browser oder OS verweigert.";
        if (err.code === 2)
          reason = "Position nicht verfügbar (kein GPS-Empfang).";
        if (err.code === 3)
          reason = "Zeitüberschreitung beim Abrufen des Standorts.";

        this.showHardwareError("Standort-Fehler", info, reason);
      },
      { timeout: 10000, enableHighAccuracy: isMobile },
    );
  },

  // 🏷️ WEB NFC
  async checkNFC() {
    const info = this.getPlatformInfo();
    this.logEvent(`NFC-Test gestartet (${info.browser} / ${info.os})`);

    if (!("NDEFReader" in window)) {
      let reason = "Web NFC wird nur von Chrome auf Android unterstützt.";
      if (info.os === "iOS")
        reason = "Apple blockiert Web NFC in allen iOS-Browsern vollständig.";
      else if (
        info.os === "Windows" ||
        info.os === "macOS" ||
        info.os === "Linux"
      ) {
        reason =
          "Desktop-Betriebssysteme haben keine NFC-Schnittstelle im Browser.";
      }

      this.showHardwareError("NFC Nicht Unterstützt", info, reason);
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();

      this.logEvent("NFC-Scan aktiv — warte auf Tag...");
      alert("NFC-Scan aktiv — halte einen NFC-Tag an dein Smartphone.");

      ndef.addEventListener("readingerror", () => {
        this.showHardwareError(
          "NFC Lesefehler",
          info,
          "Tag erkannt, aber Auslesen fehlgeschlagen.",
        );
      });

      ndef.addEventListener("reading", ({ serialNumber }) => {
        this.logEvent(`NFC Tag gelesen: ${serialNumber}`);
        alert(`NFC Tag gelesen!\nSeriennummer: ${serialNumber}`);
      });
    } catch (error) {
      this.showHardwareError("NFC Fehler", info, error.message || error);
    }
  },

  simulateNFCScan() {
    this.logEvent("SIMULIERTER NFC Scan gestartet");
    alert("⚠️ Simulierter NFC Scan gestartet...");

    setTimeout(() => {
      const fakeSerial = "04:A2:B1:" + Math.floor(1000 + Math.random() * 9000);
      this.logEvent(`SIMULIERTER Tag gelesen: ${fakeSerial}`);
      alert(`NFC Tag gelesen! (simuliert)\nSeriennummer: ${fakeSerial}`);
    }, 500);
  },
};

// ============================================================================
// 2. STUWE ICON MAPPER & HELPER
// ============================================================================
const STUWE_ICON_BASE = "images/";
const stuweIconMap = {
  empfehlung: "icon_empfehlungs_des_kuechenchefs.png.webp",
  fisch: "icon_fisch.png.webp",
  geflügel: "icon_gefluegel.png.webp",
  kalb: "icon_kalb.png.webp",
  lamm: "icon_lamm.png.webp",
  rind: "icon_rind.png.webp",
  schwein: "icon_schwein.png.webp",
  vegan: "icon_vegan.png.webp",
  vegetarisch: "icon_vegetarisch.png.webp",
  wild: "icon_wild.png.webp",
};

function getStuweIconHtml(meal) {
  if (!meal) return "";

  const textToSearch = [meal.name, meal.category, ...(meal.notes || [])]
    .join(" ")
    .toLowerCase();

  let foundIcons = "";

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
let selectedDate = "";
let canteenId = "";
let currentUniKey = "tuebingen";
let activePriceType = "students";
let activeFilterKeywords = [];
let nodes = {};
let map = null;

const API_BASE_URL = "https://openmensa.org/api/v2/canteens/";

const universityCanteens = {
  tuebingen: [
    {
      id: 1771,
      name: "Mensa Wilhelmstraße",
      lat: 48.5238,
      lng: 9.0567,
      hours: "Mo - Fr: 11:15 - 14:00 Uhr (Essensausgabe)",
      address: "Wilhelmstraße 13, 72074 Tübingen",
      url: "https://www.openstreetmap.org/search?query=Mensa+Wilhelmstraße+Tübingen",
    },
    {
      id: 1766,
      name: "Mensa Morgenstelle",
      lat: 48.5365,
      lng: 9.0347,
      hours: "Mo - Fr: 11:30 - 14:00 Uhr",
      address: "Auf der Morgenstelle 26, 72076 Tübingen",
      url: "https://www.openstreetmap.org/search?query=Mensa+Morgenstelle+Tübingen",
    },
    {
      id: 1768,
      name: "Mensa Prinz Karl",
      lat: 48.5211,
      lng: 9.0572,
      hours: "Aktuell geschlossen",
      address: "Hafengasse 6, 72070 Tübingen",
      url: "https://www.openstreetmap.org/search?query=Mensa+Prinz+Karl+Tübingen",
    },
    {
      id: 1763,
      name: "Cafeteria Morgenstelle",
      lat: 48.5365,
      lng: 9.0347,
      hours: "Mo - Fr: 11:00 - 14:30 Uhr (Tagesessen)",
      address: "Auf der Morgenstelle 26, 72076 Tübingen",
      url: "https://www.openstreetmap.org/search?query=Cafeteria+Morgenstelle+Tübingen",
    },
  ],
  uni_stuttgart: [
    {
      id: 399,
      name: "Mensa Vaihingen",
      lat: 48.7455,
      lng: 9.1066,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)",
      address: "Pfaffenwaldring 45, 70569 Stuttgart",
      url: "https://www.openstreetmap.org/search?query=Mensa+Vaihingen+Stuttgart",
    },
    {
      id: 1202,
      name: "Mensa Central",
      lat: 48.7824,
      lng: 9.1729,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)",
      address: "Ossietzkystraße 3, 70174 Stuttgart",
      url: "https://www.openstreetmap.org/search?query=Mensa+Central+Stuttgart",
    },
  ],
  hohenheim: [
    {
      id: 1765,
      name: "Mensa Hohenheim",
      lat: 48.7118,
      lng: 9.2132,
      hours: "Mo - Fr: 11:00 - 14:00 Uhr",
      address: "Garbenstraße 13, 70599 Stuttgart",
      url: "https://www.openstreetmap.org/search?query=Mensa+Hohenheim",
    },
  ],
  esslingen: [
    {
      id: 396,
      name: "Mensa Esslingen Stadtmitte",
      lat: 48.7381,
      lng: 9.3113,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)",
      address: "Kanalstraße 33, 73728 Esslingen",
      url: "https://www.openstreetmap.org/search?query=Mensa+Kanalstraße+Esslingen",
    },
    {
      id: 397,
      name: "Mensa Esslingen Flandernstraße",
      lat: 48.7483,
      lng: 9.3226,
      hours: "Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)",
      address: "Flandernstraße 101, 73732 Esslingen",
      url: "https://www.openstreetmap.org/search?query=Mensa+Flandernstraße+Esslingen",
    },
  ],
  nuertingen: [
    {
      id: 1767,
      name: "Mensa Nürtingen",
      lat: 48.6276,
      lng: 9.3361,
      hours: "Mo - Fr: 11:00 - 14:00 Uhr",
      address: "Heiligkreuzstraße 15, 72622 Nürtingen",
      url: "https://www.openstreetmap.org/search?query=Mensa+Nürtingen",
    },
  ],
  karlsruhe: [
    {
      id: 1719,
      name: "Mensa Am Adenauerring (KIT)",
      lat: 49.0118,
      lng: 8.417,
      hours: "Mo - Fr: 11:00 - 14:00 Uhr",
      address: "Adenauerring 7, 76131 Karlsruhe",
      url: "https://www.openstreetmap.org/search?query=Mensa+am+Adenauerring+Karlsruhe",
    },
    {
      id: 32,
      name: "Mensa Moltkestraße",
      lat: 49.0159,
      lng: 8.3905,
      hours: "Mo - Fr: 11:15 - 14:00 Uhr",
      address: "Moltkestraße 30, 76133 Karlsruhe",
      url: "https://www.openstreetmap.org/search?query=Mensa+Moltkestraße+Karlsruhe",
    },
  ],
};

// ============================================================================
// 4. MENSA LOGIK & DOM RENDERING
// ============================================================================

function initMap(lat, lng, name) {
  const mapElement = document.getElementById("map");
  if (!mapElement || typeof L === "undefined") return;

  if (map) map.remove();
  map = L.map("map").setView([lat, lng], 16);

  setTimeout(() => map && map.invalidateSize(), 300);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
}

function toggleDropdown(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const warOffen = target.classList.contains("offen");
  document.querySelectorAll(".filter-dropdown-container").forEach((el) => el.classList.remove("offen"));
  if (!warOffen) target.classList.add("offen");
}

function changePriceType(type) {
  activePriceType = type;
  renderMeals();
}

function applyFilters() {
  activeFilterKeywords = Array.from(document.querySelectorAll(".filter-checkbox:checked"))
    .map((cb) => cb.value.toLowerCase());
  renderMeals();
  document.getElementById("categoryDropdown")?.classList.remove("offen");
}

function resetFilters() {
  document.querySelectorAll(".filter-checkbox").forEach((cb) => (cb.checked = false));
  activeFilterKeywords = [];
  renderMeals();
  document.getElementById("categoryDropdown")?.classList.remove("offen");
}

function initEventListeners() {
  document.getElementById("menuOpenTrigger")?.addEventListener("click", toggleMenu);
  document.getElementById("menuCloseTrigger")?.addEventListener("click", toggleMenu);
  nodes.menuOverlay?.addEventListener("click", toggleMenu);

  nodes.headerCanteenTrigger?.addEventListener("click", toggleInlineDropdown);
  nodes.dropdownSchliesser?.addEventListener("click", toggleInlineDropdown);

  document.getElementById("carouselPrev")?.addEventListener("click", () => scrollCarousel(-1));
  document.getElementById("carouselNext")?.addEventListener("click", () => scrollCarousel(1));

  nodes.citySelect?.addEventListener("change", (e) => {
    currentUniKey = e.target.value;
    canteenId = universityCanteens[currentUniKey][0].id;
    updatePageHeader();
    updateCanteenDropdown(currentUniKey);
    resetMealsAndReload();
    toggleMenu();
  });

  nodes.inlineDropdown?.addEventListener("click", (e) => {
    const item = e.target.closest(".inline-dropdown-item");
    if (!item) return;

    canteenId = item.dataset.canteenId;
    updatePageHeader();
    updateCanteenDropdown(currentUniKey);
    resetMealsAndReload();
    toggleInlineDropdown();
  });
}

function setupInitialState() {
  if (nodes.citySelect) nodes.citySelect.value = "tuebingen";
  currentUniKey = "tuebingen";
  canteenId = universityCanteens["tuebingen"][0].id;

  updatePageHeader();
  updateCanteenDropdown("tuebingen");
  resetMealsAndReload();
}

function toggleMenu() {
  nodes.appSidebar?.classList.toggle("offen");
  nodes.menuOverlay?.classList.toggle("offen");
}

function toggleInlineDropdown() {
  nodes.inlineDropdown?.classList.toggle("offen");
  nodes.dropdownSchliesser?.classList.toggle("offen");
  nodes.headerCanteenTrigger?.classList.toggle("aktiv");
}

function scrollCarousel(direction) {
  const container = nodes.dayCarousel;
  if (!container) return;
  const firstButton = container.querySelector(".tag-button");
  if (!firstButton) return;

  const scrollAmount = firstButton.offsetWidth + (parseFloat(window.getComputedStyle(container).gap) || 12);
  container.scrollTo({
    left: Math.round((container.scrollLeft + scrollAmount * direction) / scrollAmount) * scrollAmount,
    behavior: "smooth",
  });
}

function updatePageHeader() {
  if (nodes.citySelect?.options && nodes.citySelect.options[nodes.citySelect.selectedIndex]) {
    if (nodes.headerUniversityTitle) {
      nodes.headerUniversityTitle.textContent = nodes.citySelect.options[nodes.citySelect.selectedIndex].text;
    }
  }

  const currentCanteen = universityCanteens[currentUniKey]?.find((c) => c.id == canteenId);
  if (currentCanteen) {
    if (nodes.headerCanteenTitle) nodes.headerCanteenTitle.textContent = currentCanteen.name;
    if (nodes.infoHours) nodes.infoHours.textContent = currentCanteen.hours;
    if (nodes.infoCanteenName) nodes.infoCanteenName.textContent = currentCanteen.name.toUpperCase();
    if (nodes.infoAddress) nodes.infoAddress.textContent = currentCanteen.address;

    if (nodes.infoMapButton) {
      nodes.infoMapButton.onclick = () => window.open(currentCanteen.url, "_blank");
    }

    if (currentCanteen.lat && currentCanteen.lng) {
      setTimeout(() => initMap(currentCanteen.lat, currentCanteen.lng, currentCanteen.name), 100);
    }
  }
}

function updateCanteenDropdown(uniKey) {
  if (!nodes.inlineDropdown) return;
  nodes.inlineDropdown.innerHTML = "";
  const fragment = document.createDocumentFragment();

  if (universityCanteens[uniKey]) {
    universityCanteens[uniKey]
      .filter((c) => c.id != canteenId)
      .forEach((c) => {
        const item = document.createElement("div");
        item.className = "inline-dropdown-item";
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
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      days.push({ date: `${yyyy}-${mm}-${dd}`, closed: false });
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

async function fetchAvailableDaysFromAPI() {
  if (!canteenId) return;

  availableDays = getTwoWeeksDays();
  if (!selectedDate || !availableDays.some((d) => d.date === selectedDate)) {
    selectedDate = availableDays[0].date;
  }

  try {
    isLoading = true;
    renderStatus();

    const url = new URL(`${canteenId}/days`, API_BASE_URL);
    const res = await fetch(url);
    if (!res.ok) throw new Error();

    const daysData = await res.json();
    if (!navigator.onLine) isOfflineError = true;

    availableDays.forEach((day) => {
      const apiDay = daysData.find((d) => d.date === day.date);
      if (apiDay) day.closed = apiDay.closed === true;
    });
  } catch (err) {
    isOfflineError = true;
  }
}

async function loadMealsForDate(date) {
  if (!date || !canteenId) return;

  isLoading = true;
  isClosed = false;
  isOfflineError = false;
  hasNoData = false;
  renderStatus();

  try {
    const url = new URL(`${canteenId}/days/${date}/meals`, API_BASE_URL);
    const res = await fetch(url);

    if (!res.ok) throw new Error();

    meals = await res.json();

    if (!navigator.onLine) {
      isOfflineError = true;
    }

    if (!meals || meals.length === 0) {
      const dayMeta = availableDays.find((d) => d.date === date);
      if (dayMeta && dayMeta.closed) {
        isClosed = true;
      } else {
        hasNoData = true;
      }
    }
  } catch (err) {
    meals = [];
    isOfflineError = true;
  } finally {
    isLoading = false;
    render();
  }
}

function renderDays() {
  if (!nodes.dayCarousel) return;
  nodes.dayCarousel.innerHTML = "";
  if (availableDays.length === 0) return;

  const fragment = document.createDocumentFragment();
  const wochentage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  availableDays.forEach((day) => {
    const d = new Date(day.date);
    const btn = document.createElement("button");
    btn.className = "tag-button";
    if (day.date === selectedDate) btn.classList.add("tag-aktiv");

    btn.innerHTML = `
      <span class="day-name">${wochentage[d.getDay()]}</span>
      <span class="day-date">${d.getDate()}.${d.getMonth() + 1}.</span>
    `;

    btn.addEventListener("click", async () => {
      if (selectedDate === day.date) return;
      selectedDate = day.date;
      nodes.dayCarousel.querySelectorAll(".tag-button").forEach((b) => b.classList.remove("tag-aktiv"));
      btn.classList.add("tag-aktiv");
      await loadMealsForDate(day.date);
    });
    fragment.appendChild(btn);
  });

  nodes.dayCarousel.appendChild(fragment);
}

function renderSelectedDayTitle() {
  if (!nodes.selectedDayTitle) return;
  if (!selectedDate) {
    nodes.selectedDayTitle.textContent = "";
    return;
  }
  const parts = selectedDate.split("-");
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const wochentageLang = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    nodes.selectedDayTitle.textContent = `${wochentageLang[d.getDay()]} ${parts[2]}.${parts[1]}.${parts[0]}`;
  } else {
    nodes.selectedDayTitle.textContent = selectedDate;
  }
}

function renderMeals() {
  if (!nodes.mealsList) return;
  nodes.mealsList.innerHTML = "";

  if (isClosed || (isOfflineError && meals.length === 0) || hasNoData) return;

  const filteredMeals = meals.filter((meal) => {
    if (activeFilterKeywords.length === 0) return true;
    const mealText = [meal.name, meal.category, ...(meal.notes || [])].join(" ").toLowerCase();
    return activeFilterKeywords.some((keyword) => mealText.includes(keyword));
  });

  if (filteredMeals.length === 0 && meals.length > 0) {
    nodes.mealsList.innerHTML =
      '<p style="color:#7f8c8d; text-align:center; font-family:Futura,sans-serif; margin-top:24px;">Keine Gerichte entsprechen den Filterkriterien.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredMeals.forEach((meal, index) => {
    const div = document.createElement("div");
    div.className = "gericht-karte";

    const priceVal = activePriceType === "students"
      ? meal.prices?.students
      : meal.prices?.employees || meal.prices?.others || meal.prices?.pupils;

    const formattedPrice = priceVal ? `${priceVal.toFixed(2).replace(".", ",")} €` : "N/A";
    const cleanNotes = (meal.notes || []).filter((note) => {
      const n = note.toLowerCase();
      return !n.includes("[vegan]") && !n.includes("[v]") && !n.includes("vegetarisch");
    });

    const uniqueId = `allergens-${index}`;
    let allergenHtml = "";
    let toggleBtn = "";

    if (cleanNotes.length > 0) {
      const notesContent = cleanNotes.some((n) => n.toLowerCase().includes("allergene"))
        ? cleanNotes.map((n) => `<div class="notes-line">${n}</div>`).join("")
        : `<div class="notes-line"><b>Infos/Allergene:</b> ${cleanNotes.join(", ")}</div>`;

      allergenHtml = `<div class="meal-notes" id="${uniqueId}">${notesContent}</div>`;
      toggleBtn = `<button class="toggle-details-btn" onclick="toggleAllergene('${uniqueId}', this)">▼</button>`;
    }

    div.innerHTML = `
      <div class="gericht-kategorie" style="margin-bottom: 4px;">${meal.category}</div>
      <div class="gericht-header">
        <div class="gericht-name">
          ${typeof getStuweIconHtml === "function" ? getStuweIconHtml(meal) : ""} ${meal.name}
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
    nodes.statusDiv.innerHTML = "";
    // Erzeugt 3 pulsierende Platzhalter-Karten als Feedback
    nodes.mealsList.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
    return;
  }

  if (isOfflineError) {
    if (meals.length === 0) {
      nodes.statusDiv.innerHTML = `
        <div class="offline-warning" style="text-align:center; padding: 24px; font-family:Futura,sans-serif; background: #fffaf0; border: 1px solid #feebc8; border-radius: 8px; margin: 20px auto; max-width: 90%;">
          <p style="color: #dd6b20; font-weight: bold; margin-bottom: 8px; font-size: 1.1rem;">⚠️ Keine Internetverbindung</p>
          <p style="color: #718096; font-size: 0.9rem; line-height: 1.4;">Für dieses Datum wurden offline noch keine Daten gespeichert. Bitte gehe online, um den Speiseplan zu laden.</p>
        </div>`;
      nodes.mealsList.innerHTML = "";
    } else {
      nodes.statusDiv.innerHTML = `
        <div style="text-align:center; margin-bottom: 12px;">
          <span style="background: #edf2f7; color: #4a5568; font-size: 0.8rem; padding: 4px 12px; border-radius: 12px; font-weight: 500; font-family: Futura, sans-serif;">
            ⚡ Offline-Modus (gespeicherte Daten)
          </span>
        </div>`;
    }
  } else if (isClosed) {
    nodes.statusDiv.innerHTML = `
      <div style="text-align:center; padding: 24px; font-family:Futura,sans-serif;">
        <p style="color: #c53030; font-weight: bold; font-size: 1.1rem; margin-bottom: 8px;">Geschlossen ❌</p>
        <p style="color: #718096; font-size: 0.9rem;">Diese Mensa hat an dem ausgewählten Tag geschlossen.</p>
      </div>`;
    nodes.mealsList.innerHTML = "";
  } else if (hasNoData) {
    nodes.statusDiv.innerHTML = `
      <div style="text-align:center; padding: 24px; font-family:Futura,sans-serif; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px auto; max-width: 90%;">
        <p style="color: #4a5568; font-weight: bold; margin-bottom: 8px; font-size: 1.1rem;">Kein Speiseplan verfügbar</p>
        <p style="color: #718096; font-size: 0.9rem; line-height: 1.4;">Für diesen Tag wurden vom Studierendenwerk noch keine Gerichte veröffentlicht.</p>
      </div>`;
    nodes.mealsList.innerHTML = "";
  } else {
    nodes.statusDiv.innerHTML = "";
  }
}

function toggleAllergene(id, btn) {
  const liste = document.getElementById(id);
  if (!liste) return;
  liste.classList.toggle("offen");
  if (btn) btn.classList.toggle("offen");
}

function prefetchUpcomingDays() {
  if (!availableDays || availableDays.length <= 1 || !canteenId) return;
  availableDays
    .filter((day) => day.date !== selectedDate)
    .forEach((day) => {
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
// INITIALISIERUNG
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.warn("Service Worker Registrierung fehlgeschlagen:", err));
  }

  nodes = {
    citySelect: document.getElementById("citySelect"),
    dayCarousel: document.getElementById("dayCarousel"),
    mealsList: document.getElementById("mealsList"),
    statusDiv: document.getElementById("status"),
    headerUniversityTitle: document.getElementById("headerUniversityTitle"),
    headerCanteenTitle: document.getElementById("headerCanteenTitle"),
    inlineDropdown: document.getElementById("inlineDropdown"),
    appSidebar: document.getElementById("appSidebar"),
    menuOverlay: document.getElementById("menuOverlay"),
    dropdownSchliesser: document.getElementById("dropdownCloser"),
    headerCanteenTrigger: document.getElementById("headerCanteenTrigger"),
    selectedDayTitle: document.getElementById("selectedDayTitle"),
    infoHours: document.getElementById("infoHours"),
    infoCanteenName: document.getElementById("infoCanteenName"),
    infoAddress: document.getElementById("infoAddress"),
    infoMapButton: document.getElementById("infoMapButton"),
  };

  initEventListeners();
  setupInitialState();

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-dropdown-container")) {
      document.querySelectorAll(".filter-dropdown-container").forEach((el) => el.classList.remove("offen"));
    }
  });

});
