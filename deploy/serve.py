"""Small static HTTP server for the systemd deployment (HTTP only)."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; "
       "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'")
TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
         '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
         '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
         '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
         '.webp': 'image/webp', '.ico': 'image/x-icon'}


def handler_for(root):
    root = Path(root).resolve()

    class Handler(BaseHTTPRequestHandler):
        def end_headers(self):
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'SAMEORIGIN')
            self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
            self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
            self.send_header('Content-Security-Policy', CSP)
            self.send_header('Cache-Control', 'no-cache')
            super().end_headers()

        def do_HEAD(self):
            self.serve(False)

        def do_GET(self):
            self.serve(True)

        def serve(self, body):
            try:
                name = unquote(urlsplit(self.path).path)
                parts = name.split('/')
                if not name.startswith('/') or any(
                    part.startswith('.') or '\\' in part or '\x00' in part for part in parts
                ):
                    raise ValueError('Invalid path')
                path = (root / name.lstrip('/')).resolve()
                if path != root and root not in path.parents:
                    raise ValueError('Outside root')
                if path.is_dir():
                    path = (path / 'index.html').resolve()
                    if root not in path.parents:
                        raise ValueError('Outside root')
                if not path.is_file():
                    raise FileNotFoundError(name)
                status = 200
            except (ValueError, OSError):
                path = root / '404.html'
                status = 404
            try:
                content = path.read_bytes()
            except OSError:
                self.send_error(500)
                return
            self.send_response(status)
            self.send_header('Content-Type', TYPES.get(path.suffix.lower(), 'application/octet-stream'))
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            if body:
                self.wfile.write(content)

    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', default='/opt/little-play/public')
    parser.add_argument('--port', type=int, default=5180)
    parser.add_argument('--bind', default='0.0.0.0')
    args = parser.parse_args()
    ThreadingHTTPServer((args.bind, args.port), handler_for(args.directory)).serve_forever()
