import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Proxy endpoint for weather data (to bypass CORS)
  if (url.pathname === '/api/weather') {
    try {
      const targetUrl = 'http://weather.maabarot.org.il/Current_Vantage_Pro.htm';
      const response = await fetch(targetUrl);
      const buffer = await response.arrayBuffer();

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=windows-1255',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(Buffer.from(buffer));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Proxy endpoint for full sensor data (Tag-List)
  if (url.pathname === '/api/sensors') {
    try {
      const targetUrl = 'http://62.128.42.5/weather/Tag-List.htm';
      const response = await fetch(targetUrl);
      const text = await response.text();

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(text);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Proxy for station images (gauges + history graphs)
  if (url.pathname.startsWith('/station/')) {
    try {
      const imagePath = url.pathname.replace('/station/', '');
      const targetUrl = `http://weather.maabarot.org.il/${imagePath}`;
      const response = await fetch(targetUrl);
      const buffer = await response.arrayBuffer();

      const ext = extname(imagePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30',
      });
      res.end(Buffer.from(buffer));
    } catch (err) {
      res.writeHead(502);
      res.end('Proxy error');
    }
    return;
  }

  // Static file serving
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = join(__dirname, filePath);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  Weather Dashboard running at:\n`);
  console.log(`  > Local:   http://localhost:${PORT}/\n`);
});
