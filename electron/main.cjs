const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');

// Prevent Chromium zygote/sandbox crash on Linux (e.g., Ubuntu 24.04 AppArmor & space-in-path /opt/Live Psalms)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}
const fs = require('fs');
const http = require('http');
const os = require('os');
const { execFile, spawn } = require('child_process');

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
      webSecurity: false
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
        webSecurity: false
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
      webSecurity: false
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
    title: 'Live Psalms — Audience Presentation Output',
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
    title: 'Live Psalms — Stage Confidence Monitor',
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
    title: 'Live Psalms — LED Wall & Motion Display Output',
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

// Live Streaming ffmpeg IPC handlers
ipcMain.handle('check-ffmpeg', () => {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (err) => {
      resolve(!err);
    });
  });
});

ipcMain.handle('start-stream', async (_event, { rtmpUrl, resolution = '1920x1080', fps = 30, bitrate = 4500 }) => {
  if (activeStreamProcess) {
    return { success: false, error: 'A stream is already running.' };
  }
  try {
    const args = [
      '-re',
      '-f', 'lavfi',
      '-i', `color=c=black:s=${resolution}:r=${fps}`,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', `${bitrate}k`,
      '-maxrate', `${bitrate}k`,
      '-bufsize', `${bitrate * 2}k`,
      '-pix_fmt', 'yuv420p',
      '-g', String(fps * 2),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'flv',
      rtmpUrl
    ];
    activeStreamProcess = spawn('ffmpeg', args);
    activeStreamProcess.stderr.on('data', (chunk) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-log', chunk.toString().trim());
      }
    });
    activeStreamProcess.on('close', () => {
      activeStreamProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-ended');
      }
    });
    return { success: true };
  } catch (err) {
    activeStreamProcess = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-stream', async () => {
  if (activeStreamProcess) {
    try {
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

