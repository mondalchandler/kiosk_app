
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const ROOT = path.join(__dirname, 'renderer');
const MEDIA_DIR = path.join(__dirname, 'media');
const PORT = 0; // random
const REFRESH_SECONDS = 60;
const MIRROR = false;
const REQUIRE_AT_LEAST = 10;
const CENTER_IMAGE = '/static-center-banner.png';

const MIME = {
  '.html':'text/html',
  '.js':'application/javascript',
  '.css':'text/css',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.gif':'image/gif',
  '.webp':'image/webp',
  '.avif':'image/avif',
  '.mp4':'video/mp4',
  '.mov':'video/quicktime',
  '.webm':'video/webm',
  '.m4v':'video/mp4',
  '.ogg':'video/ogg',
};

function listMedia() {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const files = fs.readdirSync(MEDIA_DIR).filter(f => !f.startsWith('.'));
  const items = files.map((name) => {
    const lower = name.toLowerCase();
    const ext = path.extname(lower);
    const isVideo = ['.mp4','.mov','.webm','.m4v','.ogg'].includes(ext);
    const isImage = ['.jpg','.jpeg','.png','.gif','.webp','.avif'].includes(ext);
    const stat = fs.statSync(path.join(MEDIA_DIR, name));
    return {
      id: name,
      filename: name,
      url: '/media/' + encodeURIComponent(name),
      kind: isVideo ? 'video' : (isImage ? 'image':'unknown'),
      sortKey: stat.mtimeMs || 0
    };
  }).filter(x => x.kind !== 'unknown');
  // newest first
  items.sort((a,b)=> (b.sortKey||0) - (a.sortKey||0));
  return items;
}

function serveRange(req, res, filePath, mime) {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  const start = parseInt(m[1],10);
  const end = m[2] ? parseInt(m[2],10) : total-1;
  if (start >= total || end >= total) {
    res.writeHead(416, {'Content-Range': `bytes */${total}`});
    return res.end();
  }
  res.writeHead(206, {
    'Content-Type': mime,
    'Content-Length': (end-start)+1,
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(filePath, {start, end}).pipe(res);
}

function createServer() {
  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url);
    const p = parsed.pathname || '/';
    if (p === '/api/videos') {
      const items = listMedia();
      const body = JSON.stringify({
        refreshSeconds: REFRESH_SECONDS,
        mirrorVideos: MIRROR,
        requireAtLeast: REQUIRE_AT_LEAST,
        staticCenterImage: '/static-center-banner.png',
        media: items
      });
      res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(body);
      return;
    }

    if (p.startsWith('/media/')) {
      const name = decodeURIComponent(p.replace('/media/',''));
      const filePath = path.join(MEDIA_DIR, name);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404); return res.end('Not found');
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      if (mime.startsWith('video/')) return serveRange(req, res, filePath, mime);
      res.writeHead(200, {'Content-Type': mime,'Cache-Control':'no-store'});
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // static files
    let filePath = path.join(ROOT, p === '/' ? 'index.html' : p.replace(/^\//,''));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime, 'Cache-Control':'no-store'});
      fs.createReadStream(filePath).pipe(res);
    });
  });
  return server;
}

let server, boundPort;

function startServer() {
  return new Promise((resolve, reject) => {
    server = createServer();
    server.listen(PORT, () => {
      boundPort = server.address().port;
      resolve(boundPort);
    });
    server.on('error', reject);
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow(port) {
  const win = new BrowserWindow({
    width: 960, height: 1280, x: 0, y: 0,
    backgroundColor: '#000000',
    resizable: false, frame: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration:false, contextIsolation:true }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(async () => {
  const port = await startServer();
  createWindow(port);
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
