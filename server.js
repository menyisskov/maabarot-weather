import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

// In-memory cache for proxied images (avoids slow round-trips to upstream station)
const imageCache = new Map();
const IMAGE_CACHE_TTL = 120_000; // 2 minutes

// All gauge images shown on the main page — prefetched at startup
const PREFETCH_IMAGES = [
  'OutsideTemp.gif', 'OutsideHumidity.gif', 'DewPoint.gif',
  'WindChill.gif', 'HeatIndex.gif', 'WindDirection.gif',
  'Barometer.gif', 'WindSpeed.gif',
  'Rain.gif', 'RainRate.gif', 'RainStorm.gif',
  'MonthlyRain.gif', 'YearlyRain.gif',
  'OutsideTempHistory.gif', 'BarometerHistory.gif',
];

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

  // Proxy for station images (gauges + history graphs) — with in-memory cache
  if (url.pathname.startsWith('/station/')) {
    try {
      const imagePath = url.pathname.replace('/station/', '');
      const ext = extname(imagePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const cached = imageCache.get(imagePath);
      if (cached && Date.now() - cached.ts < IMAGE_CACHE_TTL) {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=120',
        });
        res.end(cached.buffer);
        return;
      }

      const targetUrl = `http://weather.maabarot.org.il/${imagePath}`;
      const response = await fetch(targetUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      imageCache.set(imagePath, { buffer, ts: Date.now() });

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=120',
      });
      res.end(buffer);
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

// Prefetch gauge images into cache so the first visitor gets instant responses
async function prefetchImages() {
  console.log(`  Prefetching ${PREFETCH_IMAGES.length} gauge images...`);
  const results = await Promise.allSettled(
    PREFETCH_IMAGES.map(async (imagePath) => {
      const targetUrl = `http://weather.maabarot.org.il/${imagePath}`;
      const response = await fetch(targetUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      imageCache.set(imagePath, { buffer, ts: Date.now() });
    })
  );
  const ok = results.filter(r => r.status === 'fulfilled').length;
  console.log(`  Prefetched ${ok}/${PREFETCH_IMAGES.length} images.\n`);
}

server.listen(PORT, () => {
  console.log(`\n  Weather Dashboard running at:\n`);
  console.log(`  > Local:   http://localhost:${PORT}/\n`);
  prefetchImages();
});
