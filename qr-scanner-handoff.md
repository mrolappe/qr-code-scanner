# Handoff: QR-Code-Scanner-App

## 1. Ziel

Eine minimale Anwendung, die über das Kamerabild einen QR-Code erkennt und dessen Inhalt anzeigt. Verfügbar als Web-UI, installierbare Mobile-App und Desktop-App — aus **einer** Codebasis.

Leitprinzipien: einfache Entwicklung, schneller Turnaround, triviales Deployment.

## 2. Funktionaler Umfang (MVP)

- Kamerazugriff anfordern und Live-Vorschau anzeigen
- Kontinuierliche QR-Erkennung auf dem Videostream
- Bei Treffer: Scan stoppen, Inhalt anzeigen, Button „Kopieren", Button „Erneut scannen"
- Wenn der Inhalt eine URL ist: zusätzlich als anklickbarer Link
- Fehlerbehandlung: Berechtigung verweigert, keine Kamera vorhanden, unsicherer Kontext (kein HTTPS)
- Kamerawahl (Front/Rück) über `facingMode: 'environment'` als Default; Umschalter optional

**Ausdrücklich nicht im Umfang:** kein Backend, keine Scan-Historie, keine Persistenz, keine Nutzerkonten, keine anderen Barcode-Formate als QR.

## 3. Technische Entscheidungen (bereits getroffen)

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Build-Tool | **Vite** | Hot Reload, TS out of the box, statischer Output |
| Sprache | **TypeScript** | Kosten ~0 bei Vite, gute Autovervollständigung für Media-APIs |
| UI-Framework | **keines (Vanilla DOM)** | App hat 3 Zustände; React wäre Overhead |
| QR-Erkennung | **`qr-scanner`** (WASM, ~40 KB) | Einheitlich über alle Browser |
| PWA | **`vite-plugin-pwa`** | Generiert Manifest + Service Worker via Workbox |
| Desktop | **Tauri**, von Anfang an im Umfang | Kleine Binaries, lädt dasselbe `dist/` |
| Hosting | offen — Agent wählt | Cloudflare Pages, Netlify oder GitHub Pages; Kriterium: statisch, HTTPS, Git-Push-Deploy |

### Bewusst verworfen

- **`BarcodeDetector`** (Browser-native API): schneller, aber uneinheitlich unterstützt (Firefox/Safari historisch nicht). Da der Fallback ohnehin implementiert werden müsste, wird direkt nur `qr-scanner` verwendet. Kann später als optionaler Fast-Path ergänzt werden.
- React, Flutter, .NET MAUI, React Native: für diesen Umfang unnötiger Aufwand.

## 4. Architektur

Eine statische SPA. Drei Auslieferungswege auf dasselbe Build-Artefakt (`dist/`):

1. **Web** — statisches Hosting, HTTPS zwingend (Kamerazugriff nur in Secure Context).
2. **Mobile** — dieselbe URL als PWA. Android: Chrome → ⋮ → „App installieren". iOS: Safari → Teilen → „Zum Home-Bildschirm".
3. **Desktop** — Tauri bündelt `dist/` in ein System-WebView. Manifest und Service Worker sind dort wirkungslos, stören aber nicht.

## 5. Umsetzungsschritte

- [x] Projekt aufsetzen: `npm create vite@latest` (Vanilla + TS), `qr-scanner` installieren.
- [x] Scan-Kernlogik in einem eigenen Modul kapseln (Start/Stop, Callback bei Treffer) — hält sie testbar und unabhängig von der UI.
- [x] UI mit den drei Zuständen: `idle` → `scanning` → `result`. Fehlerzustände abdecken.
- [x] `vite-plugin-pwa` konfigurieren: Name, Icons (192/512 px, inkl. maskable), `display: 'standalone'`, `registerType: 'autoUpdate'`.
- [x] Deployment einrichten, HTTPS verifizieren, Installation auf Android und iOS testen.
- [x] Tauri hinzufügen (`npm create tauri-app` bzw. Tauri in bestehendes Projekt integrieren), `dist/` als Frontend einbinden.

**Status (2026-07-21):** Alle 6 Schritte umgesetzt und verifiziert: Web-Deploy live auf GitHub Pages, PWA-Installation auf Android getestet, Tauri-macOS-Build mit Kamera + Scan verifiziert. Offen: iOS-Safari-Test (auf später verschoben). Release-Build (`.app`/`.dmg`) erzeugt via `npm run tauri:build`.

## 6. Bekannte Fallstricke (bitte früh testen)

- **HTTPS:** `getUserMedia` funktioniert nur im Secure Context. `localhost` gilt als sicher, `http://` im LAN nicht — für Gerätetests HTTPS-Tunnel oder Vite-`--host` mit Zertifikat nutzen.
- **iOS/Safari:** Video-Element benötigt `playsinline` und `muted`, sonst startet die Wiedergabe nicht oder öffnet Vollbild.
- **Tauri + Kamera:** macOS braucht `NSCameraUsageDescription` in der Info.plist. Unter Linux (WebKitGTK) ist `getUserMedia` erfahrungsgemäß fragil — hier zuerst einen Machbarkeitstest fahren, bevor viel Zeit in die Desktop-Variante fließt.
- **Tauri-CSP** (`tauri.conf.json` → `app.security.csp`): `qr-scanner` startet einen Worker aus einem Blob und lädt WASM. Nötig sind daher `blob:` bei `worker-src`/`img-src` und `'wasm-unsafe-eval'` bei `script-src`. Der Kamerazugriff selbst unterliegt **nicht** der CSP. Bei stummem Scan-Fehlschlag zuerst die WebView-Konsole auf CSP-Verstöße prüfen.
- **Service-Worker-Caching:** beim Debuggen leicht verwirrend — im Dev-Modus deaktiviert lassen.

## 7. Akzeptanzkriterien

- QR-Code wird auf Desktop-Chrome, Android-Chrome und iOS-Safari innerhalb von ~1 s erkannt
- App ist auf Android und iOS als Icon installierbar und startet im Vollbild ohne Adressleiste
- Tauri-Build startet, greift auf die Kamera zu und erkennt Codes (mindestens auf der primären Zielplattform)
- Verweigerte Kameraberechtigung erzeugt eine verständliche Meldung statt eines leeren Bildschirms
- Deployment erfolgt per Git-Push ohne manuelle Schritte
