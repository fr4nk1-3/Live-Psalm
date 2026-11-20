const { app, BrowserWindow, ipcMain, screen, Menu, dialog } = require('electron');
const path = require('path');

// Prevent Chromium zygote/sandbox crash on Linux (e.g., Ubuntu 24.04 AppArmor & space-in-path /opt/Live Psalms)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const { execFile, execFileSync, spawn } = require('child_process');

function getIconPath() {
  const prodPath = path.join(__dirname, '../dist/icon.png');
  const devPath = path.join(__dirname, '../public/icon.png');
  return fs.existsSync(prodPath) ? prodPath : devPath;
}

let mainWindow = null;
let audienceWindow = null;
let stageWindow = null;
let ledWindow = null;
let activeStreamProcess = null;
let streamStopRequested = false;

/**
 * WebCodecs engine: the renderer encodes H.264 and AAC, main serves both to
 * ffmpeg over local HTTP so they arrive as two live inputs.
 */
let webcodecsOutput = null;

function closeWebcodecsOutput() {
  if (!webcodecsOutput) return;
  try {
    webcodecsOutput.videoRes?.destroy();
  } catch {}
  try {
    webcodecsOutput.audioRes?.destroy();
  } catch {}
  try {
    webcodecsOutput.server?.close();
  } catch {}
  try {
    webcodecsOutput.audioServer?.close();
  } catch {}
  webcodecsOutput = null;
}

// Default directory for Direct OBS File Output (Text GDI+ Read-from-file integration)
function getObsOutputDir() {
  try {
    const docsDir = app.getPath('documents');
    return path.join(docsDir, 'LivePsalms-OBS');
  } catch (e) {
    return path.join(os.homedir(), 'LivePsalms-OBS');
  }
}

function writeObsDirectFiles(data = {}) {
  try {
    const outDir = getObsOutputDir();
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const isHidden = data.isBlack || data.isClear;
    const slideTitle = isHidden ? '' : (data.title || '');
    const slideContent = isHidden ? '' : (data.content || '');
    const slideSubtitle = isHidden ? '' : (data.subtitle || '');
    const tickerText = isHidden ? '' : (data.ticker || '');
    const combinedSlide = [slideTitle, slideContent, slideSubtitle].filter(Boolean).join('\n');

    fs.writeFileSync(path.join(outDir, 'live_title.txt'), slideTitle, 'utf-8');
    fs.writeFileSync(path.join(outDir, 'live_slide.txt'), slideContent, 'utf-8');
    fs.writeFileSync(path.join(outDir, 'live_subtitle.txt'), slideSubtitle, 'utf-8');
    fs.writeFileSync(path.join(outDir, 'live_combined.txt'), combinedSlide, 'utf-8');
    fs.writeFileSync(path.join(outDir, 'lower_third.txt'), tickerText, 'utf-8');
    fs.writeFileSync(path.join(outDir, 'obs_state.json'), JSON.stringify({
      title: slideTitle,
      content: slideContent,
      subtitle: slideSubtitle,
      ticker: tickerText,
      updatedAt: Date.now()
    }, null, 2), 'utf-8');
    return { success: true, dir: outDir };
  } catch (err) {
    console.warn('Error writing OBS direct files:', err.message);
    return { success: false, error: err.message };
  }
}

// Connected SSE network clients + latest state cache for instant initial sync
const sseClients = new Set();
const cachedBroadcastPayloads = new Map();

function broadcastToSseClients(payload) {
  if (!payload || !payload.type) return;
  if (payload.type !== 'REQUEST_INITIAL_STATE') {
    cachedBroadcastPayloads.set(payload.type, payload);
  }
  const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of sseClients) {
    try {
      clientRes.write(dataStr);
    } catch (e) {
      sseClients.delete(clientRes);
    }
  }
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

function startLocalNetworkServer() {
  const PORT = 8080;
  const server = http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      // SSE endpoint for real-time network display sync (OBS, Stage tablets, LED walls)
      if (pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        sseClients.add(res);
        // Immediately push all cached state payloads to newly connected client
        for (const payload of cachedBroadcastPayloads.values()) {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // Direct JSON state endpoint for OBS / external integrations
      if (pathname === '/api/obs/state') {
        const outDir = getObsOutputDir();
        const statePath = path.join(outDir, 'obs_state.json');
        let jsonStr = JSON.stringify({ title: '', content: '', subtitle: '', ticker: '' });
        if (fs.existsSync(statePath)) {
          try { jsonStr = fs.readFileSync(statePath, 'utf-8'); } catch (e) {}
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(jsonStr, 'utf-8');
        return;
      }

      const distDir = path.join(__dirname, '../dist');
      let filePath = path.join(distDir, pathname);

      if (pathname === '/' || pathname.startsWith('/output')) {
        filePath = path.join(distDir, 'index.html');
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          filePath = path.join(distDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
          if (error) {
            res.writeHead(500);
            res.end('Server Error');
          } else {
            res.writeHead(200, { 
              'Content-Type': contentType, 
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            });
            res.end(content, 'utf-8');
          }
        });
      });
    } catch (e) {
      res.writeHead(500);
      res.end('Error');
    }
  });

  server.on('error', (err) => {
    console.warn('Local network server port warning:', err.message);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Psalms Local Network Output Server running on http://0.0.0.0:${PORT}`);
  });
}

function loadAppOutputUrl(win, outputQuery) {
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  const htmlPath = path.join(__dirname, '../dist/index.html');
  if (isDev) {
    win.loadURL(outputQuery ? `http://localhost:3000?output=${outputQuery}` : 'http://localhost:3000');
  } else if (outputQuery) {
    win.loadFile(htmlPath, { query: { output: outputQuery } });
  } else {
    win.loadFile(htmlPath);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Live Psalms',
    icon: getIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      webviewTag: true,
      // The scene canvas is composed in a window; pausing it when occluded
      // would freeze the stream.
      backgroundThrottling: false
    },
    backgroundColor: '#0e0e10'
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      frame: false,
      autoHideMenuBar: true,
      fullscreen: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
      webviewTag: true,
        backgroundThrottling: false
      }
    }
  }));

  loadAppOutputUrl(mainWindow, null);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.close();
    if (stageWindow && !stageWindow.isDestroyed()) stageWindow.close();
    if (ledWindow && !ledWindow.isDestroyed()) ledWindow.close();
  });
}

function resolveTargetDisplay(externalIndex = 0, displayId) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  if (displayId && displayId !== 'auto') {
    const matched = displays.find((d) => String(d.id) === String(displayId));
    if (matched) return matched;
  }
  const externalDisplays = displays.filter((d) => d.id !== primary.id);
  return externalDisplays[externalIndex] || externalDisplays[0] || primary;
}

function createOutputDisplayWindow({ existingWin, outputType, title, bgColor, externalIndex, displayId }) {
  const targetDisplay = resolveTargetDisplay(externalIndex, displayId);

  if (existingWin && !existingWin.isDestroyed()) {
    if (displayId) {
      existingWin.setFullScreen(false);
      existingWin.setBounds(targetDisplay.bounds);
      existingWin.setFullScreen(true);
    }
    existingWin.focus();
    return existingWin;
  }

  const win = new BrowserWindow({
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    title,
    icon: getIconPath(),
    frame: false,
    fullscreen: true,
    fullscreenable: true,
    resizable: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      webviewTag: true,
      // The scene canvas is composed in a window; pausing it when occluded
      // would freeze the stream.
      backgroundThrottling: false
    },
    backgroundColor: bgColor
  });

  // Remove menu bar & title bar controls completely on Windows/Linux
  win.setMenu(null);
  win.setMenuBarVisibility(false);
  if (typeof win.removeMenu === 'function') {
    win.removeMenu();
  }
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.setMenu(null);
      win.setFullScreen(true);
      // Windows keeps the taskbar above a plain fullscreen window, which shows
      // up in the stream capture. screen-saver level sits above it.
      win.setAlwaysOnTop(true, 'screen-saver');
      win.show();
    }
  });

  loadAppOutputUrl(win, outputType);
  return win;
}

// IPC Listener to query connected physical screens & network IPs
ipcMain.handle('get-connected-displays', () => {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.map((d, idx) => ({
    id: String(d.id),
    index: idx + 1,
    label: d.label || (d.id === primary.id ? `Display ${idx + 1} (Primary)` : `Display ${idx + 1} (External)`),
    isPrimary: d.id === primary.id,
    bounds: d.bounds,
    resolution: `${d.bounds.width}x${d.bounds.height}`
  }));
});

ipcMain.handle('get-network-ip', () => {
  return getLocalIpAddresses();
});

ipcMain.handle('get-window-status', () => ({
  audience: !!(audienceWindow && !audienceWindow.isDestroyed()),
  stage: !!(stageWindow && !stageWindow.isDestroyed()),
  led: !!(ledWindow && !ledWindow.isDestroyed())
}));

// Relay broadcast payloads across all open Electron windows + SSE network clients
ipcMain.on('broadcast-payload', (event, payload) => {
  broadcastToSseClients(payload);
  const allWindows = [mainWindow, audienceWindow, stageWindow, ledWindow];
  for (const win of allWindows) {
    if (win && !win.isDestroyed() && win.webContents !== event.sender) {
      win.webContents.send('broadcast-payload', payload);
    }
  }
});

// IPC Listeners to launch or close secondary & tertiary display windows
ipcMain.on('open-audience-window', (_event, opts) => {
  audienceWindow = createOutputDisplayWindow({
    existingWin: audienceWindow,
    outputType: 'audience',
    title: 'Live Psalms ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Audience Presentation Output',
    bgColor: '#000000',
    externalIndex: 0,
    displayId: opts?.displayId
  });
  audienceWindow.once('closed', () => { audienceWindow = null; });
});

ipcMain.on('close-audience-window', () => {
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.close();
  }
  audienceWindow = null;
});

ipcMain.on('open-stage-window', (_event, opts) => {
  stageWindow = createOutputDisplayWindow({
    existingWin: stageWindow,
    outputType: 'stage',
    title: 'Live Psalms ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Stage Confidence Monitor',
    bgColor: '#070b12',
    externalIndex: 1,
    displayId: opts?.displayId
  });
  stageWindow.once('closed', () => { stageWindow = null; });
});

ipcMain.on('close-stage-window', () => {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close();
  }
  stageWindow = null;
});

ipcMain.on('open-led-window', (_event, opts) => {
  ledWindow = createOutputDisplayWindow({
    existingWin: ledWindow,
    outputType: 'led',
    title: 'Live Psalms ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â LED Wall & Motion Display Output',
    bgColor: '#000000',
    externalIndex: 2,
    displayId: opts?.displayId
  });
  ledWindow.once('closed', () => { ledWindow = null; });
});

ipcMain.on('move-output-window', (_event, { outputType, displayId }) => {
  const winMap = { audience: audienceWindow, stage: stageWindow, led: ledWindow };
  const extIdxMap = { audience: 0, stage: 1, led: 2 };
  const win = winMap[outputType];
  if (win && !win.isDestroyed()) {
    const targetDisplay = resolveTargetDisplay(extIdxMap[outputType] ?? 0, displayId);
    win.setFullScreen(false);
    win.setBounds(targetDisplay.bounds);
    win.setFullScreen(true);
  }
});

ipcMain.on('close-led-window', () => {
  if (ledWindow && !ledWindow.isDestroyed()) {
    ledWindow.close();
  }
  ledWindow = null;
});

// Direct OBS File Feed IPC Handlers
ipcMain.handle('get-obs-output-dir', () => {
  const dir = getObsOutputDir();
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
  return dir;
});

ipcMain.on('write-obs-files', (_event, data) => {
  writeObsDirectFiles(data);
});

// ---------------------------------------------------------------- ffmpeg
// Resolution is deliberately defensive: a packaged app inherits the PATH that
// Explorer had when it launched, so an ffmpeg installed afterwards is often
// invisible to a bare `execFile('ffmpeg')`. Probe PATH, then the usual install
// folders, then a path the operator picked once.

const ffmpegStorePath = () => path.join(app.getPath('userData'), 'ffmpeg-path.json');

function readStoredFfmpegPath() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ffmpegStorePath(), 'utf8'));
    return typeof parsed?.path === 'string' && parsed.path ? parsed.path : null;
  } catch {
    return null;
  }
}

function storeFfmpegPath(binaryPath) {
  try {
    fs.writeFileSync(ffmpegStorePath(), JSON.stringify({ path: binaryPath }, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function findFfmpegInTree(root, depth) {
  if (!root || depth < 0) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && /^ffmpeg(\.exe)?$/i.test(entry.name)) {
      return path.join(root, entry.name);
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = findFfmpegInTree(path.join(root, entry.name), depth - 1);
    if (found) return found;
  }
  return null;
}

function findFfmpegOnPath() {
  try {
    const finder = process.platform === 'win32' ? 'where.exe' : 'which';
    const output = execFileSync(finder, ['ffmpeg'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const first = output
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean);
    return first && fs.existsSync(first) ? first : null;
  } catch {
    return null;
  }
}

function ffmpegCandidates() {
  const candidates = [];
  const add = value => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  if (process.env.FFMPEG_PATH) add(process.env.FFMPEG_PATH);
  add(readStoredFfmpegPath());
  add(findFfmpegOnPath());

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env['ProgramFiles(x86)'];

    if (local) {
      add(path.join(local, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'));
      const packages = path.join(local, 'Microsoft', 'WinGet', 'Packages');
      try {
        for (const dir of fs.readdirSync(packages)) {
          if (/ffmpeg/i.test(dir)) add(findFfmpegInTree(path.join(packages, dir), 4));
        }
      } catch {
        /* no winget packages */
      }
      add(path.join(local, 'Microsoft', 'WindowsApps', 'ffmpeg.exe'));
    }

    add('C:\\ffmpeg\\bin\\ffmpeg.exe');
    if (programFiles) add(path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'));
    if (programFilesX86) add(path.join(programFilesX86, 'ffmpeg', 'bin', 'ffmpeg.exe'));
    add('C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe');
    if (process.env.USERPROFILE) add(path.join(process.env.USERPROFILE, 'scoop', 'shims', 'ffmpeg.exe'));
  } else {
    add('/opt/homebrew/bin/ffmpeg');
    add('/usr/local/bin/ffmpeg');
    add('/usr/bin/ffmpeg');
  }

  return candidates;
}

let ffmpegBinary = null;

function resolveFfmpegBinary(force = false) {
  if (!force && ffmpegBinary && fs.existsSync(ffmpegBinary)) return ffmpegBinary;
  for (const candidate of ffmpegCandidates()) {
    if (candidate && fs.existsSync(candidate)) {
      ffmpegBinary = candidate;
      return candidate;
    }
  }
  ffmpegBinary = null;
  return null;
}

function probeFfmpeg() {
  const binary = resolveFfmpegBinary(true);
  if (!binary) {
    return Promise.resolve({
      available: false,
      path: null,
      version: null,
      error: 'ffmpeg was not found on PATH or in the usual install folders.'
    });
  }
  return new Promise(resolve => {
    execFile(binary, ['-version'], { timeout: 8000, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve({ available: false, path: binary, version: null, error: error.message });
        return;
      }
      const firstLine = String(stdout || '').split(/\r?\n/).find(Boolean) || '';
      resolve({ available: true, path: binary, version: firstLine.trim(), error: null });
    });
  });
}

ipcMain.handle('check-ffmpeg', () => probeFfmpeg());

// Lets the operator point at ffmpeg.exe once, which also fixes a stale PATH.
  // Scene sources: enumerate screens and windows for display/window capture.
  ipcMain.handle('get-desktop-sources', async (_event, kind) => {
    try {
      const { desktopCapturer } = require('electron');
      const types = kind === 'window' ? ['window'] : kind === 'screen' ? ['screen'] : ['screen', 'window'];
      const sources = await desktopCapturer.getSources({
        types,
        thumbnailSize: { width: 240, height: 135 },
        fetchWindowIcons: true
      });
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        type: source.id.startsWith('screen') ? 'screen' : 'window',
        thumbnail: source.thumbnail && !source.thumbnail.isEmpty() ? source.thumbnail.toDataURL() : ''
      }));
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
ipcMain.handle('test-stream-target', async (_event, { url }) => {
  const ffmpegPath = resolveFfmpegBinary();
  if (!ffmpegPath) return { ok: false, error: 'ffmpeg was not found.' };
  if (!url || typeof url !== 'string') return { ok: false, error: 'No stream URL.' };
  return new Promise((resolve) => {
    const args = [
      '-hide_banner', '-loglevel', 'warning',
      '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10',
      '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-f', 'flv', url
    ];
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let output = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
    }, 12000);
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      resolve({ ok: code === 0, code, error: lines.slice(-4).join(' ') });
    });
  });
});
ipcMain.handle('browse-lut', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose a 3D LUT',
    properties: ['openFile'],
    filters: [{ name: '3D LUT', extensions: ['cube', '3dl', 'dat'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('browse-ffmpeg', async () => {
  const options = {
    title: 'Locate ffmpeg',
    properties: ['openFile'],
    filters:
      process.platform === 'win32'
        ? [{ name: 'Executable', extensions: ['exe'] }]
        : [{ name: 'All files', extensions: ['*'] }]
  };
  const target = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const result = target ? await dialog.showOpenDialog(target, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths?.length) return { canceled: true };

  const chosen = result.filePaths[0];
  if (!/^ffmpeg(\.exe)?$/i.test(path.basename(chosen))) {
    return {
      canceled: false,
      available: false,
      path: chosen,
      version: null,
      error: 'Choose the ffmpeg executable itself, not another file.'
    };
  }

  storeFfmpegPath(chosen);
  ffmpegBinary = chosen;
  return { canceled: false, ...(await probeFfmpeg()) };
});

function sendStreamEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

/** Parses ffmpeg's progress lines and reports encoder telemetry to the UI. */
function attachStreamLogging() {
  const process = activeStreamProcess;
  if (!process) return;

  // Writes race with the encoder shutting down; an unhandled stream error here
  // surfaces as an uncaught exception in the main process.
  if (process.stdin) process.stdin.on('error', () => {});
  process.on('error', () => {});

  sendStreamEvent('stream-state', { state: 'connecting' });

  let announcedLive = false;
  let lastErrorLine = '';
  let publishAttempted = false;
  const applyProgress = (line) => {
    const frame = line.match(/frame=\s*(\d+)/);
    const fpsMatch = line.match(/fps=\s*([\d.]+)/);
    const bitrate = line.match(/bitrate=\s*([\d.]+)\s*kbits\/s/);
    const dropped = line.match(/drop=\s*(\d+)/);
    const speed = line.match(/speed=\s*([\d.]+)x/);
    const time = line.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const size = line.match(/size=\s*(\d+)(?:\.(\d+))?\s*([kKmM]?)i?B/);

    const stats = {};
    if (frame) stats.frames = Number(frame[1]);
    if (fpsMatch) stats.fps = Math.round(Number(fpsMatch[1]) * 10) / 10;
    if (bitrate) stats.bitrateKbps = Math.round(Number(bitrate[1]) * 10) / 10;
    if (dropped) stats.dropped = Number(dropped[1]);
    if (speed) stats.speed = Number(speed[1]);
    if (time) stats.timeSeconds = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
    if (size) {
      const unit = (size[3] || '').toLowerCase();
      const value = Number(`${size[1]}.${size[2] || 0}`);
      stats.sizeKb = Math.round(unit === 'm' ? value * 1024 : value);
    }
    if (Object.keys(stats).length === 0) return false;

    if (!announcedLive) {
      announcedLive = true;
      sendStreamEvent('stream-state', { state: 'live' });
    }
    sendStreamEvent('stream-stats', stats);
    return true;
  };

  let progressBuffer = '';
  process.stderr.on('data', (chunk) => {
    progressBuffer += chunk.toString();
    const lines = progressBuffer.split(/\r?\n|\r/);
    progressBuffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/Sending publish command/i.test(trimmed)) publishAttempted = true;
      if (/error|failed|refused|denied|handshake|unreachable|timed out|end of file/i.test(trimmed)) {
        lastErrorLine = trimmed;
      }
      // ffmpeg repeats a progress frame twice a second; keep it out of the log.
      if (!applyProgress(trimmed)) sendStreamEvent('stream-log', trimmed);
    }
  });

  process.on('close', (code) => {
    activeStreamProcess = null;
    const failed = typeof code === 'number' && code !== 0 && !streamStopRequested;
    sendStreamEvent('stream-state', {
      state: failed ? 'error' : 'ended',
      error: failed
        ? publishAttempted
          ? 'The server rejected the stream. Check the stream key and that live streaming is enabled for this account.'
          : lastErrorLine || `ffmpeg exited with code ${code}`
        : undefined
    });
    sendStreamEvent('stream-ended');
  });
}

/** Scene frames arrive from the renderer as WebM chunks. */
ipcMain.on('stream-data', (_event, chunk) => {
  const process = activeStreamProcess;
  if (!process || !process.stdin) return;
  if (process.stdin.destroyed || process.stdin.writableEnded || !process.stdin.writable) return;
  try {
    process.stdin.write(Buffer.from(chunk));
  } catch {
    /* the encoder has already gone away */
  }
});

/** WebCodecs engine: encoded H.264 and AAC arrive as separate live streams. */
ipcMain.on('stream-video-chunk', (_event, bytes, isKey) => {
  const response = webcodecsOutput?.videoRes;
  if (!response || response.writableEnded) return;
  // Under backpressure keep only keyframes; they carry the sequence headers.
  if (!isKey && response.writableLength > 4 * 1024 * 1024) return;
  try {
    response.write(Buffer.from(bytes));
  } catch {
    /* the encoder has already gone away */
  }
});

ipcMain.on('stream-audio-chunk', (_event, bytes) => {
  const response = webcodecsOutput?.audioRes;
  if (!response || response.writableEnded) return;
  try {
    response.write(Buffer.from(bytes));
  } catch {
    /* the encoder has already gone away */
  }
});

// Screen region that the live stream should show: the display the audience
// window occupies, in physical pixels (gdigrab/x11grab ignore DPI scaling).
function getStreamCaptureRegion() {
  if (!audienceWindow || audienceWindow.isDestroyed()) return null;
  const display = screen.getDisplayMatching(audienceWindow.getBounds());
  if (!display) return null;
  const scale = display.scaleFactor || 1;
  const even = (value) => (value % 2 === 0 ? value : value - 1);
  const width = even(Math.round(display.bounds.width * scale));
  const height = even(Math.round(display.bounds.height * scale));
  if (width < 16 || height < 16) return null;
  return {
    x: Math.round(display.bounds.x * scale),
    y: Math.round(display.bounds.y * scale),
    width,
    height
  };
}

// A hardware encoder can be listed by ffmpeg yet fail to initialise when the
// machine has no matching GPU, so prove it works with a tiny encode first.
function encoderUsable(ffmpegPath, encoder) {
  if (!encoder || encoder === 'libx264') return true;
  try {
    execFileSync(
      ffmpegPath,
      ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=10',
        '-t', '0.3', '-c:v', encoder, '-f', 'null', '-'],
      { timeout: 15000, windowsHide: true, stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

// Encoder-specific arguments. NVENC/QSV/AMF are hardware H.264 encoders.
function videoCodecArgs(encoder, bitrate, fps) {
  const rate = `${bitrate}k`;
  switch (String(encoder || '').toLowerCase()) {
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-tune', 'll', '-rc', 'cbr', '-profile:v', 'high', '-b:v', rate,
        '-maxrate', rate, '-bufsize', rate, '-pix_fmt', 'yuv420p', '-g', String(fps * 2), '-r', String(fps)];
    case 'h264_qsv':
      return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-profile:v', 'high', '-b:v', rate, '-maxrate', rate,
        '-bufsize', rate, '-pix_fmt', 'nv12', '-g', String(fps * 2), '-r', String(fps)];
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cbr', '-profile:v', 'high', '-b:v', rate, '-maxrate', rate,
        '-bufsize', rate, '-pix_fmt', 'yuv420p', '-g', String(fps * 2), '-r', String(fps)];
    case 'libx264':
    default:
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'high',
        '-b:v', rate, '-minrate', rate, '-maxrate', rate, '-bufsize', rate,
        '-x264-params', 'nal-hrd=cbr:force-cfr=1:filler=1', '-pix_fmt', 'yuv420p', '-g', String(fps * 2), '-r', String(fps)];
  }
}
ipcMain.handle('start-stream', async (_event, { rtmpUrl, resolution = '1920x1080', fps = 30, bitrate = 4500, audio = {}, mode = 'scene', lut = '', encoder = 'libx264', codec = 'vp8', reencode = false, hardwareEncoder = 'auto' }) => {
  if (activeStreamProcess) {
    return { success: false, error: 'A stream is already running.' };
  }
  try {
    if (mode === 'webcodecs') {
      const ffmpegPath = resolveFfmpegBinary();
      if (!ffmpegPath) {
        return { success: false, error: 'ffmpeg was not found. Use Locate ffmpeg in stream setup.' };
      }
      const hasAudio = Boolean(audio && audio.hasAudio);
      const listen = (handler) =>
        new Promise((resolve) => {
          const server = net.createServer((socket) => {
            socket.on('error', () => {});
            socket.setNoDelay(true);
            handler(socket);
          });
          server.on('error', () => {});
          server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
        });
      const video = await listen((socket) => {
        if (webcodecsOutput) webcodecsOutput.videoRes = socket;
      });
      const audioServer = hasAudio
        ? await listen((socket) => {
            if (webcodecsOutput) webcodecsOutput.audioRes = socket;
          })
        : null;
      webcodecsOutput = {
        server: video.server,
        audioServer: audioServer ? audioServer.server : null,
        videoRes: null,
        audioRes: null,
        port: video.port
      };
      const wcArgs = [
        '-use_wallclock_as_timestamps', '1', '-f', 'h264', '-framerate', String(fps), '-i', `tcp://127.0.0.1:${video.port}`,
        ...(hasAudio
          ? ['-f', 'aac', '-i', `tcp://127.0.0.1:${audioServer.port}`, '-c:a', 'copy', '-bsf:a', 'aac_adtstoasc']
          : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2']),
        '-c:v', 'copy',
        '-rtmp_buffer', '3000',
        '-rtmp_live', 'live',
        '-f', 'flv',
        rtmpUrl
      ];
      activeStreamProcess = spawn(ffmpegPath, wcArgs, { windowsHide: true });
      streamStopRequested = false;
      attachStreamLogging();
      activeStreamProcess.once('close', () => closeWebcodecsOutput());
      return { success: true, port: video.port };
    }
    // Audio input: a real capture device when one is configured, otherwise silence.
    const audioInputArgs = [];
    let audioFilter = null;
    const useDevice = audio && audio.source === 'device' && audio.device;
    if (useDevice) {
      if (process.platform === 'win32') {
        audioInputArgs.push('-f', 'dshow', '-i', `audio=${audio.device}`);
      } else if (process.platform === 'linux') {
        audioInputArgs.push('-f', 'pulse', '-i', String(audio.device));
      } else {
        audioInputArgs.push('-f', 'avfoundation', '-i', `:${audio.device}`);
      }
      const gain = typeof audio.gain === 'number' ? Math.max(0, Math.min(2, audio.gain)) : 1;
      audioFilter = audio.muted ? 'volume=0' : `volume=${gain}`;
    } else {
      audioInputArgs.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
    }

    if (mode === 'scene') {
      const ffmpegPath = resolveFfmpegBinary();
      if (!ffmpegPath) {
        return { success: false, error: 'ffmpeg was not found. Use Locate ffmpeg in stream setup.' };
      }
      // Optional creative LUT, applied on the encode path.
      const lutArgs = [];
      if (typeof lut === 'string' && lut.trim()) {
        const normalizedLut = lut.trim().replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
        lutArgs.push('-vf', `lut3d=file='${normalizedLut}'`);
      }

      const delayMs = audio && typeof audio.delayMs === 'number' ? Math.max(0, Math.min(5000, Math.round(audio.delayMs))) : 0;
      const audioArgs = delayMs > 0 ? ['-af', `adelay=${delayMs}|${delayMs}`] : [];
      // Pick the fastest encoder that actually initialises: hardware keeps the
      // CPU free and still honours CBR, which is what OBS relies on.
      const hardwareCandidates = ['h264_qsv', 'h264_nvenc', 'h264_amf'];
      let effectiveEncoder = 'libx264';
      if (String(hardwareEncoder) !== 'auto' && encoderUsable(ffmpegPath, hardwareEncoder)) {
        effectiveEncoder = hardwareEncoder;
      } else if (String(hardwareEncoder) === 'auto') {
        effectiveEncoder = hardwareCandidates.find((name) => encoderUsable(ffmpegPath, name)) || 'libx264';
      }
      if (reencode && effectiveEncoder === 'libx264' && String(hardwareEncoder) !== 'auto') {
        sendStreamEvent('stream-log', `${hardwareEncoder} could not start; using x264.`);
      }

      // A LUT needs a filter pass, so it cannot ride on a copied stream.
      const copyVideo = String(codec).toLowerCase() === 'h264' && lutArgs.length === 0 && !reencode;
      const buildSceneArgs = (encoderName) => [
        '-f', 'webm',
        '-fflags', '+genpts',
        '-i', 'pipe:0',
        ...(copyVideo ? [] : ['-fps_mode', 'cfr', '-avoid_negative_ts', 'make_zero']),
        ...lutArgs,
        ...(copyVideo ? ['-c:v', 'copy'] : videoCodecArgs(encoderName, bitrate, fps)),
        ...audioArgs,
        '-c:a', 'aac',
        '-b:a', '160k',
        '-ar', '48000',
        '-ac', '2',
        '-y',
        '-rtmp_buffer', '3000',
        '-rtmp_live', 'live',
        '-f', 'flv',
        rtmpUrl
      ];

      // A retry would start ffmpeg mid-stream, after the WebM header has already
      // gone to the failed process, so the encoder must be right before launch.
      sendStreamEvent('stream-log', 'Video encoder: ' + effectiveEncoder + (copyVideo ? ' (copy)' : ' (CBR)'));
      activeStreamProcess = spawn(ffmpegPath, buildSceneArgs(effectiveEncoder), { windowsHide: true });
      streamStopRequested = false;
      attachStreamLogging();
      return { success: true };
    }

    const capture = getStreamCaptureRegion();
    if (!capture) {
      return {
        success: false,
        error: 'Open the audience output window first; the stream captures that display.'
      };
    }

    const [targetWidth, targetHeight] = String(resolution)
      .split('x')
      .map((value) => Number(value) || 0);
    const scaleFilter =
      targetWidth && targetHeight
        ? `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,` +
          `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`
        : null;

    const screenInputArgs = [];
    if (process.platform === 'win32') {
      screenInputArgs.push(
        '-f', 'gdigrab',
        '-framerate', String(fps),
        '-draw_mouse', '0',
        '-offset_x', String(capture.x),
        '-offset_y', String(capture.y),
        '-video_size', `${capture.width}x${capture.height}`,
        '-i', 'desktop'
      );
    } else if (process.platform === 'linux') {
      screenInputArgs.push(
        '-f', 'x11grab',
        '-framerate', String(fps),
        '-draw_mouse', '0',
        '-video_size', `${capture.width}x${capture.height}`,
        '-i', `:0.0+${capture.x},${capture.y}`
      );
    } else {
      return { success: false, error: 'Screen capture for streaming is only implemented on Windows and Linux.' };
    }

    const args = [
      ...screenInputArgs,
      ...audioInputArgs,
      ...(audioFilter ? ['-af', audioFilter] : []),
      ...(scaleFilter ? ['-vf', scaleFilter] : []),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-profile:v', 'high',
      '-b:v', `${bitrate}k`,
      '-minrate', `${bitrate}k`,
      '-maxrate', `${bitrate}k`,
      '-bufsize', `${bitrate}k`,
      '-x264-params', 'nal-hrd=cbr:force-cfr=1:filler=1',
      '-pix_fmt', 'yuv420p',
      '-g', String(fps * 2),
      '-r', String(fps),
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ar', '48000',
      '-ac', '2',
      '-f', 'flv',
      rtmpUrl
    ];
    const ffmpegPath = resolveFfmpegBinary();
    if (!ffmpegPath) {
      return { success: false, error: 'ffmpeg was not found. Use Locate ffmpeg in stream setup.' };
    }
    activeStreamProcess = spawn(ffmpegPath, args, { windowsHide: true });
    streamStopRequested = false;

    attachStreamLogging();

    return { success: true };
  } catch (err) {
    activeStreamProcess = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-stream', async () => {
  streamStopRequested = true;
  closeWebcodecsOutput();
  if (activeStreamProcess) {
    try {
      activeStreamProcess.stdin?.end();
      activeStreamProcess.kill('SIGINT');
    } catch (e) {}
    activeStreamProcess = null;
  }
  return { success: true };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();
  startLocalNetworkServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


