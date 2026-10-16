const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

function getIconPath() {
  const prodPath = path.join(__dirname, '../dist/icon.png');
  const devPath = path.join(__dirname, '../public/icon.png');
  return fs.existsSync(prodPath) ? prodPath : devPath;
}

let mainWindow = null;
let audienceWindow = null;
let stageWindow = null;
let ledWindow = null;

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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Psalms Local Network Output Server running on http://0.0.0.0:${PORT}`);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Live Psalms — Worship Media & Presentation Control',
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    backgroundColor: '#090d14'
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.close();
    if (stageWindow && !stageWindow.isDestroyed()) stageWindow.close();
    if (ledWindow && !ledWindow.isDestroyed()) ledWindow.close();
  });
}

// IPC Listener to query connected physical screens & network IPs
ipcMain.handle('get-connected-displays', () => {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.map((d, idx) => ({
    id: d.id,
    index: idx + 1,
    isPrimary: d.id === primary.id,
    bounds: d.bounds,
    resolution: `${d.bounds.width}x${d.bounds.height}`
  }));
});

ipcMain.handle('get-network-ip', () => {
  return getLocalIpAddresses();
});

// IPC Listener to launch secondary & tertiary display windows
ipcMain.on('open-audience-window', (event, arg) => {
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const externalDisplay = displays.find((d) => d.id !== primary.id) || displays[0];
  const isExternalPresent = externalDisplay && externalDisplay.id !== primary.id;

  audienceWindow = new BrowserWindow({
    width: isExternalPresent ? externalDisplay.bounds.width : 1280,
    height: isExternalPresent ? externalDisplay.bounds.height : 720,
    x: isExternalPresent ? externalDisplay.bounds.x : undefined,
    y: isExternalPresent ? externalDisplay.bounds.y : undefined,
    title: 'Live Psalms — Audience Presentation Output',
    frame: false,
    fullscreen: isExternalPresent,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    backgroundColor: '#000000'
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  const htmlPath = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    audienceWindow.loadURL('http://localhost:3000?output=audience');
  } else {
    audienceWindow.loadFile(htmlPath, { query: { output: 'audience' } });
  }

  audienceWindow.on('closed', () => {
    audienceWindow = null;
  });
});

ipcMain.on('open-stage-window', (event, arg) => {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const externalDisplays = displays.filter((d) => d.id !== primary.id);
  const stageDisplay = externalDisplays.length > 1 ? externalDisplays[1] : (externalDisplays[0] || primary);
  const isExternalPresent = stageDisplay && stageDisplay.id !== primary.id;

  stageWindow = new BrowserWindow({
    width: isExternalPresent ? stageDisplay.bounds.width : 1280,
    height: isExternalPresent ? stageDisplay.bounds.height : 720,
    x: isExternalPresent ? stageDisplay.bounds.x : undefined,
    y: isExternalPresent ? stageDisplay.bounds.y : undefined,
    title: 'Live Psalms — Stage Confidence Monitor',
    frame: false,
    fullscreen: isExternalPresent,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    backgroundColor: '#070b12'
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  const htmlPath = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    stageWindow.loadURL('http://localhost:3000?output=stage');
  } else {
    stageWindow.loadFile(htmlPath, { query: { output: 'stage' } });
  }

  stageWindow.on('closed', () => {
    stageWindow = null;
  });
});

ipcMain.on('open-led-window', (event, arg) => {
  if (ledWindow && !ledWindow.isDestroyed()) {
    ledWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const externalDisplays = displays.filter((d) => d.id !== primary.id);
  const ledDisplay = externalDisplays.length > 2 ? externalDisplays[2] : (externalDisplays[0] || primary);
  const isExternalPresent = ledDisplay && ledDisplay.id !== primary.id;

  ledWindow = new BrowserWindow({
    width: isExternalPresent ? ledDisplay.bounds.width : 1280,
    height: isExternalPresent ? ledDisplay.bounds.height : 720,
    x: isExternalPresent ? ledDisplay.bounds.x : undefined,
    y: isExternalPresent ? ledDisplay.bounds.y : undefined,
    title: 'Live Psalms — LED Wall & Motion Display Output',
    frame: false,
    fullscreen: isExternalPresent,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    backgroundColor: '#000000'
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  const htmlPath = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    ledWindow.loadURL('http://localhost:3000?output=led');
  } else {
    ledWindow.loadFile(htmlPath, { query: { output: 'led' } });
  }

  ledWindow.on('closed', () => {
    ledWindow = null;
  });
});

app.whenReady().then(() => {
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

