import { Injectable } from '@angular/core';

// Global deklarierte Bibliotheken aus index.html
declare const jsQR: any;
declare const NDEFReader: any;

@Injectable({
  providedIn: 'root',
})
export class HardwareService {
  qrScanActive = false;
  private qrCanvas: HTMLCanvasElement | null = null;
  private qrBannerTimeout: any = null;

  logEvent(message: string): void {
    console.log(message);
  }

  getPlatformInfo(): { os: string; appInfo: string } {
    const ua = navigator.userAgent;
    let os = 'Unbekanntes OS';
    let appInfo = 'Unbekannter Browser';

    if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Macintosh/i.test(ua)) os = 'macOS';
    else if (/Windows/i.test(ua)) os = 'Windows';

    const isPWA =
      (window.navigator as any).standalone ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (os === 'iOS') {
      appInfo = isPWA ? 'Home-Bildschirm PWA (WebKit)' : 'iOS Browser (WebKit)';
    } else {
      if (/Chrome/i.test(ua))
        appInfo = isPWA ? 'Chrome PWA (Blink)' : 'Chrome (Blink)';
      else if (/Firefox/i.test(ua)) appInfo = 'Firefox (Gecko)';
      else if (/Edg/i.test(ua)) appInfo = 'Edge (Blink)';
      else appInfo = 'Browser';
    }

    return { os, appInfo };
  }

  showHardwareError(title: string, info: { os: string; appInfo: string }, reason: string): void {
    this.logEvent(`ERROR: ${title} — ${reason}`);
    alert(
      `⚠️ ${title}\n` +
        `System: ${info.os} (${info.appInfo})\n\n` +
        `Grund: ${reason}`
    );
  }

  // 📷 KAMERA & QR SCANNER
  async checkCamera(): Promise<void> {
    const info = this.getPlatformInfo();

    const video = document.getElementById('cameraStream') as HTMLVideoElement;
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');

    if (!video || !overlay || !btn) {
      console.error('Kamera-Elemente wurden nicht gefunden.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showHardwareError(
        'Kamera nicht unterstützt',
        info,
        'Dieser Browser unterstützt keinen Kamerazugriff.'
      );
      return;
    }

    if (typeof jsQR === 'undefined') {
      this.showHardwareError(
        'QR Scanner nicht geladen',
        info,
        'Die jsQR-Bibliothek wurde nicht gefunden. Bitte jsQR im HTML einbinden.'
      );
      return;
    }

    try {
      const isMobile = info.os === 'iOS' || info.os === 'Android';
      let stream: MediaStream;

      if (isMobile) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      overlay.style.display = 'flex';
      video.srcObject = stream;

      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('muted', 'true');

      await video.play();

      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
        } else {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        }
      });

      btn.classList.add('success');
      this.qrScanActive = true;

      requestAnimationFrame(this.scanQRCode.bind(this));
    } catch {
      this.stopCamera();

      this.showHardwareError(
        'Kamerazugriff fehlgeschlagen',
        info,
        'Zugriff verweigert oder keine Kamera gefunden.'
      );
    }
  }

  scanQRCode(): void {
    if (!this.qrScanActive) return;

    const video = document.getElementById('cameraStream') as HTMLVideoElement;

    if (!video || !video.videoWidth || !video.videoHeight) {
      requestAnimationFrame(this.scanQRCode.bind(this));
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (!this.qrCanvas) {
        this.qrCanvas = document.createElement('canvas');
      }

      const canvas = this.qrCanvas;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof jsQR !== 'undefined') {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            this.qrScanActive = false;
            let targetUrl = code.data.trim();

            this.logEvent(`QR-Code erkannt: ${targetUrl}`);

            if (navigator.vibrate) {
              navigator.vibrate(100);
            }

            this.stopCamera();

            if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('/')) {
              targetUrl = 'https://' + targetUrl;
            }

            const qrBanner = document.getElementById('qr-banner');
            const qrBannerText = document.getElementById('qr-banner-text');

            if (qrBanner && qrBannerText) {
              qrBannerText.textContent = `Öffnen: ${targetUrl}`;
              qrBanner.classList.add('aktiv');

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
    }

    requestAnimationFrame(this.scanQRCode.bind(this));
  }

  stopCamera(): void {
    this.qrScanActive = false;

    const video = document.getElementById('cameraStream') as HTMLVideoElement;
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('btnCamera');

    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    if (overlay) overlay.style.display = 'none';
    if (btn) btn.classList.remove('success');
  }

  hideQRBanner(): void {
    const qrBanner = document.getElementById('qr-banner');
    if (qrBanner) qrBanner.classList.remove('aktiv');
    if (this.qrBannerTimeout) {
      clearTimeout(this.qrBannerTimeout);
      this.qrBannerTimeout = null;
    }
  }

  // 📶 BLUETOOTH
  async checkBluetooth(): Promise<void> {
    const info = this.getPlatformInfo();
    const btn = document.getElementById('btnBluetooth');
    const nav = navigator as any;

    if (!nav.bluetooth) {
      let reason = 'Dieser Browser unterstützt die Web Bluetooth API nicht.';
      if (info.os === 'iOS')
        reason = 'Apple blockiert Web Bluetooth in allen iOS-Browsern.';

      this.showHardwareError('Bluetooth nicht verfügbar', info, reason);
      return;
    }

    try {
      const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true });
      await device.gatt.connect();

      if (btn) btn.classList.add('success');
      this.logEvent(`Bluetooth verbunden: ${device.name || 'Unbenannt'}`);
      alert(`✅ Verbunden mit "${device.name || 'Unbenannt'}"`);
      setTimeout(() => btn && btn.classList.remove('success'), 3000);
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
        this.logEvent('Bluetooth Koppelung abgebrochen');
        return;
      }
      this.showHardwareError('Bluetooth Verbindung fehlgeschlagen', info, err.message || err);
    }
  }

  // 📍 GPS / GEOLOCATION
  checkGPS(): void {
    const info = this.getPlatformInfo();
    const btn = document.getElementById('btnGPS');

    if (!navigator.geolocation) {
      this.showHardwareError('GPS nicht unterstützt', info, 'Geolocation API fehlt.');
      return;
    }

    const isMobile = info.os === 'iOS' || info.os === 'Android';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);

        if (btn) btn.classList.add('success');
        this.logEvent(`GPS empfangen: Lat ${lat}, Lng ${lng}`);
        alert(`📍 Position ermittelt!\nLat: ${lat}, Lng: ${lng}`);
        setTimeout(() => btn && btn.classList.remove('success'), 3000);
      },
      (err) => {
        let reason = 'Unbekannter Fehler bei Standortabfrage.';
        if (err.code === 1) reason = 'Standortzugriff im Browser oder OS verweigert.';
        if (err.code === 2) reason = 'Position nicht verfügbar (kein GPS-Empfang).';
        if (err.code === 3) reason = 'Zeitüberschreitung beim Abrufen des Standorts.';

        this.showHardwareError('Standort-Fehler', info, reason);
      },
      { timeout: 10000, enableHighAccuracy: isMobile }
    );
  }

  // 🏷️ WEB NFC
  async checkNFC(): Promise<void> {
    const info = this.getPlatformInfo();

    if (!('NDEFReader' in window)) {
      let reason = 'Web NFC wird nur von Chrome auf Android unterstützt.';
      if (info.os === 'iOS') {
        reason = 'Apple blockiert Web NFC in allen iOS-Browsern vollständig.';
      } else if (['Windows', 'macOS', 'Linux'].includes(info.os)) {
        reason = 'Desktop-Betriebssysteme haben keine NFC-Schnittstelle im Browser.';
      }

      this.showHardwareError('NFC Nicht Unterstützt', info, reason);
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();

      this.logEvent('NFC-Scan aktiv — warte auf Tag...');
      alert('NFC-Scan aktiv — halte einen NFC-Tag an dein Smartphone.');

      ndef.addEventListener('readingerror', () => {
        this.showHardwareError('NFC Lesefehler', info, 'Tag erkannt, aber Auslesen fehlgeschlagen.');
      });

      ndef.addEventListener('reading', ({ serialNumber }: any) => {
        this.logEvent(`NFC Tag gelesen: ${serialNumber}`);
        alert(`NFC Tag gelesen!\nSeriennummer: ${serialNumber}`);
      });
    } catch (error: any) {
      this.showHardwareError('NFC Fehler', info, error.message || error);
    }
  }
}