import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';

const sseClients = new Set<any>();
const cachedPayloads = new Map<string, any>();

// Server-side OBS WebSocket v5 client (bridges Live Psalms directly to OBS Studio on port 4455)
let serverObsWs: WebSocket | null = null;
let serverObsConnected = false;
let serverObsError = '';
let latestObsSlideData: any = {};

function pushToServerObs(data: any) {
  if (!serverObsConnected || !serverObsWs || serverObsWs.readyState !== 1) return;
  const hidden = !!(data.isBlack || data.isClear);
  const titleText = hidden ? '' : (data.title || '');
  const bodyText = hidden ? '' : (data.content || '');
  const subText = hidden ? '' : (data.subtitle || '');
  const slideBodyText = [bodyText, subText].filter(Boolean).join('\n');
  const tickerText = hidden ? '' : (data.ticker || '');

  const sendReq = (requestType: string, requestData: any) => {
    try {
      serverObsWs?.send(JSON.stringify({
        op: 6,
        d: {
          requestType,
          requestId: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          requestData
        }
      }));
    } catch (e) {}
  };

  sendReq('SetInputSettings', {
    inputName: 'LivePsalms_Slide',
    inputSettings: {
      text: slideBodyText,
      font: { face: 'Sans Serif', size: 48, flags: 1, style: 'Bold' },
      word_wrap: true,
      custom_width: 1600,
      drop_shadow: true,
      outline: true
    },
    overlay: true
  });
  sendReq('SetInputSettings', {
    inputName: 'LivePsalms_Title',
    inputSettings: {
      text: titleText,
      font: { face: 'Sans Serif', size: 36, flags: 1, style: 'Bold' },
      word_wrap: true,
      custom_width: 1600,
      drop_shadow: true,
      outline: true
    },
    overlay: true
  });
  sendReq('SetInputSettings', {
    inputName: 'LivePsalms_Ticker',
    inputSettings: {
      text: tickerText,
      font: { face: 'Sans Serif', size: 32, flags: 1, style: 'Bold' },
      word_wrap: true,
      custom_width: 1600,
      drop_shadow: true,
      outline: true
    },
    overlay: true
  });
}

function connectServerObs(wsUrl = 'ws://127.0.0.1:4455'): Promise<{ connected: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (serverObsWs && serverObsConnected && serverObsWs.readyState === 1) {
        pushToServerObs(latestObsSlideData);
        return resolve({ connected: true });
      }
      if (serverObsWs) {
        try { serverObsWs.close(); } catch (e) {}
      }
      const ws = new WebSocket(wsUrl);
      serverObsWs = ws;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          serverObsConnected = false;
          serverObsError = 'Timed out connecting to OBS WebSocket on port 4455.';
          resolve({ connected: false, error: serverObsError });
        }
      }, 3000);

      ws.onmessage = (evt: any) => {
        try {
          const msg = JSON.parse(typeof evt.data === 'string' ? evt.data : evt.data.toString());
          if (msg.op === 0) {
            ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
          } else if (msg.op === 2) {
            clearTimeout(timeout);
            serverObsConnected = true;
            serverObsError = '';
            // Query current program scene and provision sources in OBS
            ws.send(JSON.stringify({
              op: 6,
              d: { requestType: 'GetCurrentProgramScene', requestId: 'init-scene' }
            }));
            if (!settled) {
              settled = true;
              resolve({ connected: true });
            }
          } else if (msg.op === 7 && msg.d?.requestId === 'init-scene' && msg.d?.requestStatus?.result) {
            const sceneName = msg.d.responseData?.currentProgramSceneName || 'Scene';
            const ips = getLocalIps();
            const hostIp = ips[0] || '127.0.0.1';
            // Configure Browser 2 if present to point to transparent OBS overlay
            ws.send(JSON.stringify({
              op: 6,
              d: {
                requestType: 'SetInputSettings',
                requestId: 'cfg-browser2',
                requestData: {
                  inputName: 'Browser 2',
                  inputSettings: {
                    url: `http://${hostIp}:3000/?output=obs`,
                    width: 1920,
                    height: 1080,
                    css: 'html, body, #root { background: transparent !important; background-color: rgba(0, 0, 0, 0) !important; margin: 0px auto; overflow: hidden; }'
                  },
                  overlay: true
                }
              }
            }));
            // Create native FreeType2 / GDI+ text sources in the active OBS scene if not already created
            const sourceConfigs = [
              { name: 'LivePsalms_Title', size: 36 },
              { name: 'LivePsalms_Slide', size: 48 },
              { name: 'LivePsalms_Ticker', size: 32 }
            ];
            ['text_ft2_source_v2', 'text_gdiplus_v2'].forEach(inputKind => {
              sourceConfigs.forEach(cfg => {
                ws.send(JSON.stringify({
                  op: 6,
                  d: {
                    requestType: 'CreateInput',
                    requestId: `create-${cfg.name}-${inputKind}`,
                    requestData: {
                      sceneName,
                      inputName: cfg.name,
                      inputKind,
                      inputSettings: {
                        text: '',
                        font: { face: 'Sans Serif', size: cfg.size, flags: 1, style: 'Bold' },
                        word_wrap: true,
                        custom_width: 1600,
                        drop_shadow: true,
                        outline: true
                      },
                      sceneItemEnabled: false
                    }
                  }
                }));
              });
            });
            if (latestObsSlideData && Object.keys(latestObsSlideData).length > 0) {
              setTimeout(() => pushToServerObs(latestObsSlideData), 250);
            }
          }
        } catch (e) {}
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        serverObsConnected = false;
        serverObsError = 'Could not connect to OBS WebSocket on port 4455.';
        if (!settled) {
          settled = true;
          resolve({ connected: false, error: serverObsError });
        }
      };

      ws.onclose = () => {
        serverObsConnected = false;
      };
    } catch (err: any) {
      serverObsConnected = false;
      serverObsError = err?.message || 'OBS WebSocket error';
      resolve({ connected: false, error: serverObsError });
    }
  });
}

function getObsOutputDir() {
  const docsDir = path.join(os.homedir(), 'Documents');
  const base = fs.existsSync(docsDir) ? docsDir : os.homedir();
  const outDir = path.join(base, 'LivePsalms-OBS');
  if (!fs.existsSync(outDir)) {
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
  }
  return outDir;
}

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

function writeObsDirectFiles(data: any = {}) {
  try {
    const outDir = getObsOutputDir();
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
    return outDir;
  } catch (e) {
    return getObsOutputDir();
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'live-psalms-obs-and-sse-bridge',
      configureServer(server) {
        // Initialize OBS directory & empty files on startup, and auto-connect to OBS if open
        writeObsDirectFiles({});
        connectServerObs('ws://127.0.0.1:4455').catch(() => {});

        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0] || '';

          if (url === '/api/obs/connect' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              let targetUrl = 'ws://127.0.0.1:4455';
              try {
                const parsed = JSON.parse(body || '{}');
                if (parsed.url) targetUrl = parsed.url.replace(/192\.168\.\d+\.\d+/, '127.0.0.1');
              } catch (e) {}
              const result = await connectServerObs(targetUrl);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            });
            return;
          }

          if (url === '/api/obs/disconnect' && req.method === 'POST') {
            if (serverObsWs) {
              try { serverObsWs.close(); } catch (e) {}
              serverObsWs = null;
            }
            serverObsConnected = false;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ connected: false }));
            return;
          }

          if (url === '/api/system/displays' && req.method === 'GET') {
            if (process.platform === 'linux') {
              execFile('xrandr', ['--listactivemonitors'], { timeout: 2500 }, (err, stdout = '') => {
                const parsed: any[] = [];
                if (!err && stdout) {
                  for (const line of stdout.split('\n')) {
                    const m = line.match(/^\s*\d+:\s+(\+\*?|\*?)\S+\s+(\d+)(?:\/\d+)?x(\d+)(?:\/\d+)?\+(\-?\d+)\+(\-?\d+)\s+(.+)$/);
                    if (!m) continue;
                    const isPrim = m[1].includes('*');
                    const w = parseInt(m[2], 10);
                    const h = parseInt(m[3], 10);
                    const x = parseInt(m[4], 10);
                    const y = parseInt(m[5], 10);
                    const name = m[6].trim();
                    parsed.push({
                      id: `xrandr-${parsed.length + 1}`,
                      index: parsed.length + 1,
                      label: `${name} (${isPrim ? 'Primary' : 'External'})`,
                      isPrimary: isPrim,
                      bounds: { x, y, width: w, height: h },
                      resolution: `${w}x${h}`
                    });
                  }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ displays: parsed }));
              });
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ displays: [] }));
            return;
          }

          if (url === '/api/events' && req.method === 'GET') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            });
            sseClients.add(res);
            for (const payload of cachedPayloads.values()) {
              res.write(`data: ${JSON.stringify(payload)}\n\n`);
            }
            req.on('close', () => sseClients.delete(res));
            return;
          }

          if (url === '/api/broadcast' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                if (payload && payload.type) {
                  if (payload.type === 'MEDIA_CMD_PLAY') {
                    cachedPayloads.delete('MEDIA_CMD_STOP');
                    cachedPayloads.delete('MEDIA_CMD_PAUSE');
                    cachedPayloads.set('MEDIA_CMD_PLAY', payload);
                  } else if (payload.type === 'MEDIA_CMD_STOP') {
                    cachedPayloads.delete('MEDIA_CMD_PLAY');
                    cachedPayloads.delete('MEDIA_CMD_RESUME');
                    cachedPayloads.set('MEDIA_CMD_STOP', payload);
                  } else if (payload.type === 'MEDIA_CMD_PAUSE') {
                    cachedPayloads.delete('MEDIA_CMD_RESUME');
                    cachedPayloads.set('MEDIA_CMD_PAUSE', payload);
                  } else if (payload.type === 'MEDIA_CMD_RESUME') {
                    cachedPayloads.delete('MEDIA_CMD_PAUSE');
                    cachedPayloads.set('MEDIA_CMD_RESUME', payload);
                  } else if (payload.type === 'LIVE_SLIDE_CHANGE') {
                    const s = payload.liveSlide;
                    const isPureVideo = s && s.backgroundType === 'video' && !s.content;
                    if (!isPureVideo) {
                      cachedPayloads.delete('MEDIA_CMD_PLAY');
                    }
                    cachedPayloads.set('LIVE_SLIDE_CHANGE', payload);
                  } else if (payload.type !== 'REQUEST_INITIAL_STATE' && payload.type !== 'MEDIA_STATUS') {
                    cachedPayloads.set(payload.type, payload);
                  }
                  const msg = `data: ${JSON.stringify(payload)}\n\n`;
                  for (const client of sseClients) {
                    try { client.write(msg); } catch (e) { sseClients.delete(client); }
                  }
                }
              } catch (e) {}
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            });
            return;
          }

          if (url === '/api/obs/sync' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              let dir = getObsOutputDir();
              try {
                const data = JSON.parse(body);
                latestObsSlideData = data;
                dir = writeObsDirectFiles(data);
                if (!serverObsConnected) {
                  connectServerObs('ws://127.0.0.1:4455').then(() => pushToServerObs(data)).catch(() => {});
                } else {
                  pushToServerObs(data);
                }
              } catch (e) {}
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, dir, obsConnected: serverObsConnected }));
            });
            return;
          }

          if (url === '/api/media/upload' && req.method === 'POST') {
            const queryStr = req.url?.split('?')[1] || '';
            const params = new URLSearchParams(queryStr);
            const rawName = params.get('name') || `media-${Date.now()}.mp4`;
            const safeName = `${Date.now()}-${rawName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const mediaDir = path.join(getObsOutputDir(), 'media');
            if (!fs.existsSync(mediaDir)) {
              try { fs.mkdirSync(mediaDir, { recursive: true }); } catch (e) {}
            }
            const filePath = path.join(mediaDir, safeName);
            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);
            writeStream.on('finish', () => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, url: `/api/media/${encodeURIComponent(safeName)}`, filename: safeName }));
            });
            writeStream.on('error', (err) => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: err.message }));
            });
            return;
          }

          if (url.startsWith('/api/media/') && req.method === 'GET') {
            const filename = decodeURIComponent(url.replace('/api/media/', ''));
            const safeFilename = path.basename(filename);
            const mediaDir = path.join(getObsOutputDir(), 'media');
            const filePath = path.join(mediaDir, safeFilename);
            if (!fs.existsSync(filePath)) {
              res.writeHead(404);
              res.end('Not found');
              return;
            }
            const stat = fs.statSync(filePath);
            const ext = path.extname(safeFilename).toLowerCase();
            const mimeMap: Record<string, string> = {
              '.mp4': 'video/mp4',
              '.webm': 'video/webm',
              '.mov': 'video/quicktime',
              '.mkv': 'video/x-matroska',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.webp': 'image/webp',
              '.gif': 'image/gif'
            };
            const contentType = mimeMap[ext] || 'application/octet-stream';
            const range = req.headers.range;
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
              const chunkSize = end - start + 1;
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
              });
              fs.createReadStream(filePath, { start, end }).pipe(res);
            } else {
              res.writeHead(200, {
                'Content-Length': stat.size,
                'Accept-Ranges': 'bytes',
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
              });
              fs.createReadStream(filePath).pipe(res);
            }
            return;
          }

          if (url === '/api/obs/info' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              obsOutputDir: getObsOutputDir(),
              networkIps: getLocalIps(),
              obsConnected: serverObsConnected
            }));
            return;
          }

          if (url === '/api/obs/state' && req.method === 'GET') {
            const statePath = path.join(getObsOutputDir(), 'obs_state.json');
            let jsonStr = JSON.stringify({ title: '', content: '', subtitle: '', ticker: '' });
            if (fs.existsSync(statePath)) {
              try { jsonStr = fs.readFileSync(statePath, 'utf-8'); } catch (e) {}
            }
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(jsonStr);
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: true,
    watch: {
      // Editors write atomically through hidden temp directories; watching those
      // files crashes chokidar with EBUSY on Windows.
      ignored: [/[\\/]\.[^\\/]*\.tmpdir[\\/]/, '**/*.tmp']
    }
  }
});
