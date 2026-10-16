<h1 align="center">
  📖 Live Psalms
</h1>

<p align="center">
  <strong>A powerful, offline-first Church Presentation & Bible Study application for Windows</strong>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows" />
  <img alt="Built with Electron" src="https://img.shields.io/badge/built%20with-Electron-47848F?style=flat-square&logo=electron" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

---

## ✨ Features

### 🎤 Live Presentation
- **Multi-display output** — Project to a second screen, LED wall, stage display, or OBS virtual camera simultaneously
- **Sermon Mode** — Distraction-free mode for preachers with large text and auto-scrolling
- **Slide Designer** — Customise background, fonts, and colours for every slide
- **Quick Presentation** — Instantly display any verse without leaving the main view
- **Stage Display** — Separate output for the stage monitor showing current + next slide

### 📖 Bible
- **45 preloaded Bible translations** — all offline, no internet required
- **Language-grouped version picker** — browse by Swahili, Luo, Kikuyu, Kalenjin, Kamba, Maasai, or English
- **Global search** — search any word or phrase across the entire Bible instantly
- **Optional API Online** — connect to additional online versions via the API Bible service

### 🎵 Songs & Media
- **Song library** — import and manage your church's song catalogue
- **Custom slides** — create announcement, countdown, and media slides
- **Playlist builder** — organise your service order with drag-and-drop

### 💾 Import & Export
- **Import custom Bibles** — load your own `.json` or `.xml` Bible files
- **Import songs** — support for OpenLyrics XML and plain-text formats
- **Broadcast service** — stream slide content to connected devices on the same network

---

## 🌍 Preloaded Bible Translations (45 total)

### 🇰🇪 Kenyan Languages
| Language | Translations |
|----------|-------------|
| **Swahili** | Biblia Takatifu (SUV), Habari Njema (RSUV) |
| **Luo** | Muma Mutakatifu 1985, 2015, 2020 |
| **Kikuyu** | Ibuku Rĩa Ngai 2013, 2014, 2019 |
| **Kalenjin** | Baibil Noet Standard, 2019, Revised |
| **Kamba** | Mbivilia Standard, Mbivilia (MBV) |
| **Maasai** | Bibilia 1970, 2020, Standard, MBS |

### 🇬🇧 English (28 translations)
KJV, NKJV, NIV, ESV, NLT, NASB, AMP, AMPC, BSB, CSB, TPT, GNT, HCSB, NET, NIrV, NRSV, ASV, Darby, ERV, EASY, GW, LSB, MEV, NASU, RSV, TLB, Tyndale 1537, YLT

---

## 📦 Download

Go to the [**Releases**](https://github.com/fr4nk1-3/Live-Psalm/releases) page to download the latest version:

| File | Description |
|------|-------------|
| `LivePsalms-Setup.exe` | Windows Installer — installs to Program Files with Start Menu shortcut |
| `LivePsalms-Windows-Portable.exe` | Portable — no installation needed, just double-click and run |

> **Requirements**: Windows 10 or later (64-bit)

---

## 🛠️ Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [Git](https://git-scm.com/)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/fr4nk1-3/Live-Psalm.git
cd Live-Psalm

# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Build for Production

```bash
# Build the web assets only
npm run build

# Build Windows Portable exe
npm run build:win -- --win portable

# Build Windows Installer (requires Wine on Linux)
npm run build:win -- --win nsis
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | [Electron](https://www.electronjs.org/) v32 |
| UI Framework | [React](https://react.dev/) 18 + TypeScript |
| Build Tool | [Vite](https://vitejs.dev/) 5 |
| Styling | Tailwind CSS |
| Icons | [Lucide React](https://lucide.dev/) |
| Packaging | [electron-builder](https://www.electron.build/) |

---

## 📁 Project Structure

```
Live Psalms/
├── electron/               # Electron main process
├── src/
│   ├── components/         # UI components
│   │   ├── BibleVersionModal.tsx     # Language-grouped version picker
│   │   ├── BibleBookVerseModal.tsx   # Book & verse selector
│   │   ├── GlobalSearchModal.tsx     # Full-Bible search
│   │   ├── LibraryTabs.tsx           # Songs, Bibles, Media library
│   │   ├── SettingsModal.tsx         # App settings
│   │   └── ...
│   ├── data/
│   │   └── bibles/         # 45 preloaded Bible JSON files + manifest
│   ├── services/
│   │   ├── storage.ts      # Bible loading & app persistence
│   │   ├── importer.ts     # Bible & song import logic
│   │   ├── onlineBibleApi.ts  # API Bible integration
│   │   └── broadcast.ts    # Network broadcast service
│   └── App.tsx             # Root application
├── package.json
└── vite.config.ts
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

MIT © [Live Psalms](https://github.com/fr4nk1-3/Live-Psalm)
