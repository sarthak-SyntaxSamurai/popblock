<div align="center">

# 🛡️ PopBlock — Popup & Redirect Blocker

**Force-stops unwanted popups, pop-unders, and sneaky redirects before they hijack your browser.**

[![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Firefox](https://img.shields.io/badge/Firefox-Compatible-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org)
[![Brave](https://img.shields.io/badge/Brave-Compatible-FB542B?style=for-the-badge&logo=brave&logoColor=white)](https://brave.com)
[![Edge](https://img.shields.io/badge/Edge-Compatible-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://www.microsoft.com/edge)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## ⚡ Features

- 🚫 **Popup Blocker** — Blocks intrusive popups, pop-unders & overlay ads
- 🔄 **Redirect Shield** — Catches and reverts sneaky cross-origin redirects
- 📋 **Smart Whitelist** — Easily whitelist trusted sites
- 📊 **Block Counter** — Real-time badge showing blocks per tab
- 🎯 **100+ Network Rules** — Built-in declarativeNetRequest rules for known ad/tracker domains
- 🌐 **Works Everywhere** — Compatible with Chrome, Brave, Edge & other Chromium browsers
- 🪶 **Lightweight** — No bloat, no tracking, just pure protection

---

## 🚀 Quick Install (Easiest Way)

### Option 1: Download ZIP from Releases (Recommended)

1. Go to the [**Releases**](../../releases) page
2. Download the latest `popblock-vX.X.X.zip`
3. Unzip the downloaded file
4. Open your browser and go to `chrome://extensions/`
5. Enable **"Developer mode"** (toggle in top-right)
6. Click **"Load unpacked"**
7. Select the unzipped `popblock` folder
8. ✅ Done! PopBlock is now active

### Option 2: Clone from GitHub

```bash
git clone https://github.com/sarthak-SyntaxSamurai/popblock.git
```

Then follow steps 4-8 from Option 1.

---

## 📸 Screenshots

| Popup UI | Badge Counter |
|----------|---------------|
| Clean toggle interface with block stats | Real-time block count on extension icon |

---

## 🏗️ Project Structure

```
popblock/
├── manifest.json          # Extension config (Manifest V3)
├── service-worker.js      # Background service worker
├── icons/                 # Extension icons (16/32/48/128px)
├── content/
│   ├── blocker.js         # Content script — popup/redirect blocking
│   └── bridge.js          # ISOLATED world bridge for messaging
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
└── rules/
    └── rules.json         # declarativeNetRequest rules (100+)
```

---

## 🔧 How It Works

PopBlock uses a **multi-layer blocking strategy**:

1. **Network Layer** — `declarativeNetRequest` rules block known ad/tracker domains at the network level before they even load
2. **Content Layer** — Content scripts (`blocker.js`) run in `MAIN` world to intercept `window.open()`, `document.createElement('a')`, and other popup techniques
3. **Navigation Layer** — Service worker monitors `webNavigation` events to detect and revert suspicious cross-origin client redirects
4. **Bridge Layer** — `bridge.js` runs in `ISOLATED` world to securely relay blocked-event messages to the service worker

---

## 🛠️ Development

### Prerequisites
- Chrome/Brave/Edge browser
- Git

### Setup
```bash
# Clone the repo
git clone https://github.com/sarthak-SyntaxSamurai/popblock.git

# Load in browser
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the popblock folder
```

### Making Changes
After editing any file, go to `chrome://extensions/` and click the **refresh** ↻ button on the PopBlock card.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Sarthak** ([@sarthak-SyntaxSamurai](https://github.com/sarthak-SyntaxSamurai))

---

<div align="center">

**If PopBlock helped you, consider giving it a ⭐!**

</div>
