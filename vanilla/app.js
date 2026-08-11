const HardwareController = {
  qrScanActive: false,
  qrCanvas: null,

  // Browser and OS detection
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

  // 🍞 TOAST NOTIFICATIONS (replaces alert())
  ensureToastContainer() {
    let container = document.getElementById('hc-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hc-toast-container';
      container.style.cssText = `
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
        pointer-events: none;
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
      background: ${c.bg};
      border: 1px solid ${c.border};
      color: ${c.text};
      padding: 10px 16px;
      border-radius: 8px;
      font-family: Futura, sans-serif;
      font-size: 0.9rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 90vw;
      text-align: center;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.25s ease, transform 0.25s ease;
      transform: translateY(-8px);
      white-space: pre-line;
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

  // Toast Notification
  showHardwareError(title, systemInfo, reason) {
    this.showToast(
      `⚠️ ${title}\n${systemInfo.browser} on ${systemInfo.os}\n${reason}`,
      'error',
      6000
    );
  },

  // 📷 CAMERA & QR SCANNER
  async checkCamera() {
    const info = this.getPlatformInfo();
    const video = document.getElementById('cameraStream');
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showHardwareError("Camera Not Supported", info, "This browser does not support camera access (MediaDevices API missing).");
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

      overlay.style.display = 'flex';
      video.srcObject = stream;
      btn.classList.add('success');

      video.setAttribute("playsinline", true);
      video.play();

      this.qrScanActive = true;
      requestAnimationFrame(this.scanQRCode.bind(this));

    } catch (err) {
      this.showHardwareError(
        "Camera Access Denied",
        info,
        `Camera access was denied or no camera device is available.\n(Details: ${err.message || err})`
      );
    }
  },

  scanQRCode() {
    if (!this.qrScanActive) return;

    const video = document.getElementById('cameraStream');
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
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
          this.showToast(`QR Code Detected:\n${code.data}`, 'success');
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

    if (video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }

    overlay.style.display = 'none';
    btn.classList.remove('success');
  },

  // 📶 BLUETOOTH
  async checkBluetooth() {
    const info = this.getPlatformInfo();
    const btn = document.getElementById('btnBluetooth');

    if (!navigator.bluetooth) {
      let reason = "This browser does not support the Web Bluetooth API.";
      if (info.os === "iOS") {
        reason = "Apple strictly blocks Web Bluetooth in all iOS browsers.";
      } else if (info.browser === "Safari") {
        reason = "Safari does not support Web Bluetooth. Please use Google Chrome or Microsoft Edge.";
      } else if (info.browser === "Firefox") {
        reason = "Firefox has disabled Web Bluetooth by default due to security concerns.";
      }

      this.showHardwareError("Bluetooth Unavailable", info, reason);
      return;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });

      // Track disconnects, since GATT connections silently drop
      device.addEventListener('gattserverdisconnected', () => {
        btn.classList.remove('success');
        this.showToast(`🔌 "${device.name || 'Device'}" disconnected.`, 'info');
      });

      const server = await device.gatt.connect();

      btn.classList.add('success');
      // FIX: actually tell the user what happened, instead of just flashing the button
      this.showToast(
        `✅ Connected to "${device.name || 'Unnamed device'}"\nGATT server: ${server.connected ? 'connected' : 'not connected'}`,
        'success',
        5000
      );

    } catch (err) {
      if (err.name === 'NotFoundError' || err.message.includes('User cancelled')) {
        console.log("Bluetooth pairing cancelled by user.");
        return;
      }

      this.showHardwareError("Bluetooth Connection Failed", info, err.message || err);
    }
  },

  // 📍 GPS / LOCATION
  checkGPS() {
    const info = this.getPlatformInfo();
    const btn = document.getElementById('btnGPS');

    if (!navigator.geolocation) {
      this.showHardwareError("GPS Not Supported", info, "This browser does not support geolocation (Geolocation API missing).");
      return;
    }

    const isMobile = info.os === "iOS" || info.os === "Android";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);

        btn.classList.add('success');
        this.showToast(
          `📍 Location Acquired!\nLat: ${lat}, Lng: ${lng}\n${info.browser} on ${info.os}`,
          'success'
        );
        setTimeout(() => btn.classList.remove('success'), 3000);

        console.log(`GPS Position locked (${info.os}): Lat ${lat}, Lng ${lng}`);
      },
      (err) => {
        let reason = "Unknown error occurred while retrieving location.";
        if (err.code === 1) reason = "Location access was denied in browser or operating system settings.";
        if (err.code === 2) reason = "Position unavailable (GPS/network signal down).";
        if (err.code === 3) reason = "Timeout expired while fetching location.";

        this.showHardwareError("Location Error", info, reason);
      },
      { timeout: 10000, enableHighAccuracy: isMobile }
    );
  },

  // 🏷️ WEB NFC
  async checkNFC() {
    const info = this.getPlatformInfo();

    if (!('NDEFReader' in window)) {
      let reason = "Web NFC is an experimental feature currently only supported by Chrome on Android.";
      if (info.os === "iOS") {
        reason = "Apple completely blocks Web NFC inside all iOS browsers.";
      } else if (info.os === "Windows" || info.os === "macOS" || info.os === "Linux") {
        reason = "Desktop operating systems lack standardized hardware APIs for inline web NFC reading.";
      }

      this.showHardwareError("NFC Not Supported", info, reason);
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();

      console.log("NFC scan session initialized.");
      this.showToast("NFC scanning active — hold a tag near your device.", 'info');

      ndef.addEventListener("readingerror", () => {
        this.showHardwareError("NFC Read Error", info, "NFC tag detected, but reading failed.");
      });

      ndef.addEventListener("reading", ({ serialNumber }) => {
        this.showToast(`NFC Tag Read!\nSerial: ${serialNumber}`, 'success');
      });

    } catch (error) {
      this.showHardwareError("NFC Error", info, error.message || error);
    }
  }
};