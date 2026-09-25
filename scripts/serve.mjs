// Local preview only. Use Caddy or Nginx for public production hosting.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.PORT || 5180);
const host = process.env.HOST || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('Cache-Control', 'no-cache');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.') || part.includes('\\'))) throw new Error('Invalid path');
    let path = resolve(root, `.${pathname}`);
    if (path !== resolve(root) && !path.startsWith(resolve(root) + sep)) throw new Error('Invalid path');
    const info = await stat(path);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        // Build a same-origin Location even for unusual paths with repeated slashes.
        response.writeHead(308, { Location: '/' + pathname.replace(/^\/+/, '') + '/' + url.search }).end();
        return;
      }
      path = resolve(path, 'index.html');
    }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': content.length });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    const content = await readFile(resolve(root, '404.html'));
    response.writeHead(404, { 'Content-Type': types['.html'] });
    response.end(request.method === 'HEAD' ? undefined : content);
  }
}).listen(port, host, () => console.log(`玩一会儿 → http://${host}:${port}\nPreview root: ${root}\nPress Ctrl+C to stop.`));
