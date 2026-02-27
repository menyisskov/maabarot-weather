// Ma'abarot Weather Station - Modern Dashboard
const REFRESH_INTERVAL = 150000; // 2.5 minutes

// ===== Netanya Live Weather (Open-Meteo API) =====
const NETANYA_LAT = 32.33;
const NETANYA_LON = 34.86;

const WMO_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  56: '🌨️', 57: '🌨️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌨️', 67: '🌨️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const WMO_DESC_HE = {
  0: 'שמיים בהירים', 1: 'בהיר בעיקר', 2: 'מעונן חלקית', 3: 'מעונן',
  45: 'ערפל', 48: 'ערפל כבד',
  51: 'טפטוף קל', 53: 'טפטוף', 55: 'טפטוף כבד',
  61: 'גשם קל', 63: 'גשם', 65: 'גשם כבד',
  80: 'ממטרים קלים', 81: 'ממטרים', 82: 'ממטרים כבדים',
  95: 'סופת רעמים', 96: 'סופת רעמים עם ברד', 99: 'סופת ברד',
};

async function fetchNetanyaWeather() {
  try {
    const params = new URLSearchParams({
      latitude: NETANYA_LAT,
      longitude: NETANYA_LON,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index',
      hourly: 'temperature_2m,weather_code',
      timezone: 'Asia/Jerusalem',
      forecast_days: 1,
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const c = data.current;

    // Current values
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('wTemp', Math.round(c.temperature_2m));
    set('wFeelsLike', `${Math.round(c.apparent_temperature)}°C`);
    set('wHumidity', `${c.relative_humidity_2m}%`);
    set('wWind', `${Math.round(c.wind_speed_10m)} km/h`);
    set('wPrecip', `${c.precipitation} מ"מ`);
    set('wUV', c.uv_index !== undefined ? Math.round(c.uv_index) : '--');
    set('wCloud', `${c.cloud_cover}%`);

    // Weather icon
    const iconEl = document.getElementById('widgetIcon');
    if (iconEl) {
      iconEl.textContent = WMO_ICONS[c.weather_code] || '🌡️';
    }

    // Update subtitle with description
    const subtitleEl = document.querySelector('.widget-subtitle');
    if (subtitleEl) {
      const desc = WMO_DESC_HE[c.weather_code] || '';
      subtitleEl.textContent = desc ? `עכשיו - ${desc}` : 'עכשיו';
    }

    // Hourly forecast
    if (data.hourly) {
      const forecastEl = document.getElementById('widgetForecast');
      if (forecastEl) {
        const currentHour = new Date().getHours();
        let html = '';
        // Show next 12 hours starting from current hour
        for (let i = currentHour; i < Math.min(currentHour + 12, data.hourly.time.length); i++) {
          const time = new Date(data.hourly.time[i]);
          const hour = time.getHours();
          const isNow = i === currentHour;
          const icon = WMO_ICONS[data.hourly.weather_code[i]] || '🌡️';
          const temp = Math.round(data.hourly.temperature_2m[i]);

          html += `
            <div class="forecast-hour ${isNow ? 'now' : ''}">
              <span class="forecast-time">${isNow ? 'עכשיו' : `${String(hour).padStart(2, '0')}:00`}</span>
              <span class="forecast-icon">${icon}</span>
              <span class="forecast-temp">${temp}°</span>
            </div>
          `;
        }
        forecastEl.innerHTML = html;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch Netanya weather:', err.message);
  }
}

// ===== Lightbox Modal =====
function createModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" aria-label="סגור">&times;</button>
      <div class="modal-title"></div>
      <img src="" alt="">
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove('active');
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return overlay;
}

function openModal(url, title) {
  const overlay = document.querySelector('.modal-overlay') || createModal();
  const img = overlay.querySelector('img');
  const titleEl = overlay.querySelector('.modal-title');

  titleEl.textContent = title || '';
  img.src = url;
  overlay.classList.add('active');
}

// Intercept all graph links to open in lightbox
function setupGraphLinks() {
  document.querySelectorAll('.graph-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.match(/\.(gif|png|jpg|jpeg)$/i)) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const title = link.closest('.gauge-card')?.querySelector('.gauge-label')?.textContent
          || link.textContent;
        openModal(href, title);
      });
    }
  });
}

// ===== Gauge Refresh =====
function refreshGauges() {
  document.querySelectorAll('.gauge-card img, .gauge-card-wide img').forEach(img => {
    const url = new URL(img.src, window.location.origin);
    url.searchParams.set('t', Date.now());
    img.src = url.toString();
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  setupGraphLinks();
  fetchNetanyaWeather();
  setInterval(refreshGauges, REFRESH_INTERVAL);
  setInterval(fetchNetanyaWeather, 600000); // refresh every 10 min
});
