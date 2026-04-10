const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;

function parsePortFromArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--port=')) {
      return arg.slice('--port='.length);
    }
    if (arg === '--port' && i + 1 < argv.length) {
      return argv[i + 1];
    }
  }
  return null;
}

const cliPort = parsePortFromArgs(process.argv.slice(2));
const rawPort = cliPort || process.env.PORT || '5888';
const PORT = Number.parseInt(rawPort, 10);
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`Invalid port "${rawPort}". Use a value between 1 and 65535.`);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function safeResolvePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const trimmed = decodedPath.replace(/^\/+/, '');
  const requested = trimmed === '' ? 'index.html' : trimmed;
  const normalized = path.normalize(requested);
  const absolute = path.resolve(ROOT_DIR, normalized);
  if (!absolute.startsWith(ROOT_DIR)) return null;
  return absolute;
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed');
  }

  if ((req.url || '').split('?')[0] === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  const filePath = safeResolvePath(req.url || '/');
  if (!filePath) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      return send(res, 404, 'Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });

    if (method === 'HEAD') {
      return res.end();
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => send(res, 500, 'Internal Server Error'));
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
