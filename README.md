<div align="center">
  <img src="assets/sorestilogo.png" alt="Soresti Launcher" width="120" height="120"/>

  # ⚡ Soresti Launcher

  **Modern, fast, and feature-rich Minecraft launcher**

  <p>
    <a href="https://github.com/anilmisayten-cmyk/SorestiLauncher/releases">
      <img src="https://img.shields.io/github/v/release/anilmisayten-cmyk/SorestiLauncher?style=for-the-badge&color=brightgreen" alt="Release"/>
    </a>
    <a href="https://github.com/anilmisayten-cmyk/SorestiLauncher/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/anilmisayten-cmyk/SorestiLauncher?style=for-the-badge&color=blue" alt="License"/>
    </a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue?style=for-the-badge" alt="Platform"/>
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-screenshots">Screenshots</a> •
    <a href="#-download">Download</a> •
    <a href="#-building-from-source">Build</a> •
    <a href="#-tech-stack">Tech Stack</a>
  </p>

  <br/>
</div>

---

## ✨ Features

<table>
  <tr>
    <td align="center" width="33%">🚀 <b>Ultra-Fast Downloads</b><br/><sub>256-parallel asset downloads, BMCLAPI mirrors, max bandwidth usage – no more waiting at 10%</sub></td>
    <td align="center" width="33%">👥 <b>Multi-Account Support</b><br/><sub>Add, switch, and manage multiple Minecraft accounts seamlessly</sub></td>
    <td align="center" width="33%">🎨 <b>Custom Branding</b><br/><sub>Animated text, custom MC font, video splash screen, modern UI</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%">📦 <b>One-Click Installer</b><br/><sub>Custom NSIS installer with desktop shortcuts and clean uninstall</sub></td>
    <td align="center" width="33%">🖼️ <b>3D Skin Preview</b><br/><sub>View your Minecraft skin in 3D with skinview3d</sub></td>
    <td align="center" width="33%">⚙️ <b>Full Version Support</b><br/><sub>From 1.16.5 to latest – automatic version detection and installation</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%">🧩 <b>Mod Management</b><br/><sub>Built-in mod browser and installer for Forge, Fabric, and Quilt</sub></td>
    <td align="center" width="33%">💻 <b>Console & Debug</b><br/><sub>Real-time game output console for troubleshooting</sub></td>
    <td align="center" width="33%">🎬 <b>Video Splash</b><br/><sub>Custom intro video on startup, skippable with click or Escape</sub></td>
  </tr>
</table>

---

## 🖼️ Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><b>Login Screen</b></td>
      <td align="center"><b>Home Page</b></td>
    </tr>
    <tr>
      <td><img src="assets/sorestilogo.png" alt="Login" width="400"/></td>
      <td><img src="assets/sorestilogo.png" alt="Home" width="400"/></td>
    </tr>
    <tr>
      <td align="center"><b>Account Switcher</b></td>
      <td align="center"><b>Version Manager</b></td>
    </tr>
    <tr>
      <td><img src="assets/sorestilogo.png" alt="Account Switcher" width="400"/></td>
      <td><img src="assets/sorestilogo.png" alt="Versions" width="400"/></td>
    </tr>
  </table>
</div>

---

## 📥 Download

Get the latest installer from the [Releases page](https://github.com/anilmisayten-cmyk/SorestiLauncher/releases).

| Version | Installer |
|---------|-----------|
| **Latest** | [Soresti Launcher Setup.exe](https://github.com/anilmisayten-cmyk/SorestiLauncher/releases/latest) |

<details>
<summary><b>System Requirements</b></summary>

| Requirement | Minimum |
|-------------|---------|
| **OS** | Windows 10 / 11 (x64) |
| **RAM** | 4 GB |
| **Storage** | 500 MB (plus Minecraft installations) |
| **Java** | Java 17+ (auto-detected) |
| **Internet** | Broadband connection |

</details>

---

## 🔧 Building from Source

```bash
# Clone the repository
git clone https://github.com/anilmisayten-cmyk/SorestiLauncher.git
cd SorestiLauncher

# Install dependencies
npm install

# Build the app
npm run build

# Package as installer
npm run dist
```

The installer will be created in the `release/` directory.

### Development

```bash
# Start in development mode (hot-reload)
npm run dev

# Run with Electron
npm run start
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Electron](https://www.electronjs.org/) | Desktop application framework |
| [React](https://react.dev/) | UI library |
| [TypeScript](https://www.typescriptlang.org/) | Programming language |
| [Zustand](https://github.com/pmndrs/zustand) | State management |
| [Framer Motion](https://www.framer.com/motion/) | Animations |
| [Webpack](https://webpack.js.org/) | Module bundler |
| [Axios](https://axios-http.com/) | HTTP client |
| [skinview3d](https://github.com/bs-community/skinview3d) | 3D skin rendering |
| [electron-builder](https://www.electron.build/) | Installer packaging |

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

<div align="center">
  <br/>
  <sub>Built with ❤️ by the Soresti Team</sub>
  <br/><br/>
  <img src="assets/sorestilogo.png" alt="Soresti" width="48"/>
</div>
