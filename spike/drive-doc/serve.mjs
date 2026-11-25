// Serves the spike folder at http://localhost:8080 so the Drive test page can sign in with Google.
// (Google sign-in needs an http(s) origin that is listed on the OAuth client; file:// does not work.)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/drive-doc/' });
    return res.end();
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (file.endsWith(path.sep)) file = path.join(file, 'index.html');
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, 'localhost', () => console.log(`Drive test page: http://localhost:${PORT}/drive-doc/`));
