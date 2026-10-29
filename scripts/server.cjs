const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../app');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
});
const requested = Number(process.env.LOCKTODO_PORT || 8793);
if (!Number.isInteger(requested) || requested < 1 || requested > 65535) throw new Error('LOCKTODO_PORT must be between 1 and 65535');
let port = requested;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < Math.min(requested + 20, 65535)) {
    port += 1;
    server.listen(port, '0.0.0.0');
  } else {
    console.error(error.message);
    process.exitCode = 1;
  }
});
server.on('listening', () => {
  const url = `http://localhost:${port}`;
  console.log(`\nLockTodo preview: ${url}`);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) console.log(`Same-network iPhone: http://${entry.address}:${port}`);
    }
  }
  console.log('Keep this terminal open. Press Ctrl+C to stop.\n');
  if (process.env.LOCKTODO_OPEN === '1') {
    const opener = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
    opener.on('error', error => console.warn(`Open the URL above in your browser: ${error.message}`));
    opener.unref();
  }
});
server.listen(port, '0.0.0.0');
