import './style.css'
import { ScanCore } from './scanner.ts'

type State =
  | { name: 'idle' }
  | { name: 'scanning' }
  | { name: 'result'; text: string }
  | { name: 'error'; message: string }

const app = document.querySelector<HTMLDivElement>('#app')!

// Single persistent video element — must not be recreated while scanning or the stream detaches.
const video = document.createElement('video')
video.playsInline = true
video.muted = true
video.setAttribute('playsinline', '')
video.setAttribute('muted', '')

const scanCore = new ScanCore(video)
let state: State = { name: 'idle' }
let hit = false // guards against qr-scanner's fallback firing onHit more than once

function setState(next: State): void {
  state = next
  render()
}

function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError') {
      return 'Camera permission was denied. Enable it in your browser settings.'
    }
    if (err.name === 'NotFoundError') {
      return 'No camera found on this device.'
    }
    return `${err.name}: ${err.message}`
  }
  return String(err)
}

async function startScanning(): Promise<void> {
  if (window.isSecureContext === false) {
    setState({ name: 'error', message: 'Camera needs HTTPS (or localhost).' })
    return
  }
  hit = false
  setState({ name: 'scanning' })
  try {
    await scanCore.start((text) => {
      if (hit) return
      hit = true
      scanCore.stop()
      setState({ name: 'result', text })
    })
  } catch (err) {
    setState({ name: 'error', message: friendlyError(err) })
  }
}

function cancelScanning(): void {
  scanCore.stop()
  setState({ name: 'idle' })
}

/** Only linkify http(s) URLs — avoids rendering arbitrary schemes like javascript:. */
function httpUrlOrNull(text: string): URL | null {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function render(): void {
  video.remove() // detach so it can be re-inserted into the new markup below

  if (state.name === 'idle') {
    app.innerHTML = `
      <div class="screen">
        <h1>QR Scanner</h1>
        <button id="start" class="btn btn-primary">Start scanning</button>
      </div>
    `
    app.querySelector('#start')!.addEventListener('click', startScanning)
    return
  }

  if (state.name === 'scanning') {
    app.innerHTML = `
      <div class="screen">
        <div class="video-wrap"></div>
        <div class="actions">
          <button id="toggle" class="btn">Flip camera</button>
          <button id="cancel" class="btn">Cancel</button>
        </div>
      </div>
    `
    app.querySelector('.video-wrap')!.appendChild(video)
    app.querySelector('#toggle')!.addEventListener('click', () => scanCore.toggleFacingMode())
    app.querySelector('#cancel')!.addEventListener('click', cancelScanning)
    return
  }

  if (state.name === 'result') {
    const url = httpUrlOrNull(state.text)
    app.innerHTML = `
      <div class="screen">
        <h1>Scanned</h1>
        <p class="result-text"></p>
        ${url ? `<a id="link" class="btn" href="${url.href}" target="_blank" rel="noopener">Open link</a>` : ''}
        <div class="actions">
          <button id="copy" class="btn">Copy</button>
          <button id="again" class="btn btn-primary">Scan again</button>
        </div>
      </div>
    `
    app.querySelector('.result-text')!.textContent = state.text
    const copyBtn = app.querySelector<HTMLButtonElement>('#copy')!
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(state.name === 'result' ? state.text : '')
      const original = copyBtn.textContent
      copyBtn.textContent = 'Copied!'
      setTimeout(() => (copyBtn.textContent = original), 1500)
    })
    app.querySelector('#again')!.addEventListener('click', startScanning)
    return
  }

  // error
  app.innerHTML = `
    <div class="screen">
      <h1>Something went wrong</h1>
      <p class="error-text"></p>
      <button id="retry" class="btn btn-primary">Try again</button>
    </div>
  `
  app.querySelector('.error-text')!.textContent = state.message
  app.querySelector('#retry')!.addEventListener('click', () => setState({ name: 'idle' }))
}

render()
