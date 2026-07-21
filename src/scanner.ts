import type QrScanner from 'qr-scanner'

export type FacingMode = 'environment' | 'user'
export type Engine = 'barcode-detector' | 'qr-scanner'

// ponytail: minimal shim, no @types package for the still-experimental Barcode Detection API
interface BarcodeDetectorResult {
  rawValue: string
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance
  getSupportedFormats(): Promise<string[]>
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

/** Pure engine selection — no browser globals, testable under node. */
export function pickEngine(hasBarcodeDetector: boolean, supportsQr: boolean): Engine {
  return hasBarcodeDetector && supportsQr ? 'barcode-detector' : 'qr-scanner'
}

export interface CameraInfo {
  id: string
  label: string
}

export class ScanCore {
  private video: HTMLVideoElement
  private facingMode: FacingMode
  private onHit: ((text: string) => void) | null = null
  private stream: MediaStream | null = null
  private rafId: number | null = null
  private qrScanner: QrScanner | null = null

  constructor(video: HTMLVideoElement, facingMode: FacingMode = 'environment') {
    this.video = video
    this.facingMode = facingMode
  }

  async start(onHit: (text: string) => void): Promise<void> {
    this.onHit = onHit
    const hasBarcodeDetector = 'BarcodeDetector' in window
    const supportsQr = hasBarcodeDetector
      ? (await window.BarcodeDetector!.getSupportedFormats()).includes('qr_code')
      : false

    if (pickEngine(hasBarcodeDetector, supportsQr) === 'barcode-detector') {
      await this.startBarcodeDetector(onHit)
    } else {
      await this.startQrScanner(onHit)
    }
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    if (this.qrScanner) {
      this.qrScanner.stop()
      this.qrScanner.destroy()
      this.qrScanner = null
    }
  }

  async listCameras(): Promise<CameraInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({ id: d.deviceId, label: d.label || 'camera' }))
  }

  /** Switch facing mode (front/back toggle) and restart scanning with the last-used callback. */
  async setFacingMode(mode: FacingMode): Promise<void> {
    this.facingMode = mode
    const onHit = this.onHit
    this.stop()
    if (onHit) await this.start(onHit)
  }

  async toggleFacingMode(): Promise<void> {
    await this.setFacingMode(this.facingMode === 'environment' ? 'user' : 'environment')
  }

  private async startBarcodeDetector(onHit: (text: string) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facingMode } })
    this.video.srcObject = this.stream
    this.video.playsInline = true
    this.video.muted = true
    await this.video.play()

    const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
    const loop = async (): Promise<void> => {
      try {
        const results = await detector.detect(this.video)
        if (results.length > 0) {
          onHit(results[0].rawValue)
          this.stop()
          return
        }
      } catch {
        // transient decode error — keep scanning
      }
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private async startQrScanner(onHit: (text: string) => void): Promise<void> {
    const { default: QrScannerImpl } = await import('qr-scanner')
    this.qrScanner = new QrScannerImpl(this.video, (result) => onHit(result.data), {
      preferredCamera: this.facingMode,
      highlightScanRegion: false,
    })
    await this.qrScanner.start()
  }
}
