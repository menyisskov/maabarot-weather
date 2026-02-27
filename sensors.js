// Sensors page - fetch Tag-List.htm data and visualize
const SENSOR_REFRESH = 150000; // 2.5 minutes

function parseTagList(html) {
  const data = {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const cells = doc.querySelectorAll('td');

  // Build case-insensitive map of key->value
  const rawMap = {};
  for (let i = 0; i < cells.length - 1; i += 2) {
    const key = cells[i].textContent.trim().toLowerCase();
    const val = cells[i + 1].textContent.trim();
    if (key) rawMap[key] = val;
  }

  const get = (k) => rawMap[k.toLowerCase()] || '';

  // Parse number from value string like "19.3 °C" or "1006.1 mb" or "97 % at 7:43"
  const num = (k) => {
    const v = get(k);
    if (!v || v.startsWith('---')) return null;
    // Match the first number (with optional negative and decimal)
    const m = v.match(/-?\d+\.?\d*/);
    return m ? parseFloat(m[0]) : null;
  };

  // Parse time from value like "19.9 °C at 13:52"
  const timeFrom = (k) => {
    const v = get(k);
    const m = v.match(/at\s+(\d{1,2}:\d{2})/);
    return m ? m[1] : '';
  };

  // Station info
  data.stationName = get('station name');
  data.date = get('date on the station') || get('date on the pc');
  data.time = get('time on the station') || get('time on the pc');
  data.sunrise = get('sunrise time');
  data.sunset = get('sunset time');

  // Outside Temp
  data.outsideTemp = num('outside temperature');
  data.outsideTempHigh = num('high outside temperature');
  data.outsideTempHighTime = timeFrom('high outside temperature');
  data.outsideTempLow = num('low outside temperature');
  data.outsideTempLowTime = timeFrom('low outside temperature');
  data.outsideTempMonthHigh = num('high monthly outside temp');
  data.outsideTempMonthLow = num('low monthly outside temp');
  data.outsideTempYearHigh = num('high yearly outside temp');
  data.outsideTempYearLow = num('low yearly outside temp');

  // Inside Temp
  data.insideTemp = num('inside temperature');
  data.insideTempHigh = num('high inside temperature');
  data.insideTempLow = num('low inside temperature');
  data.insideTempMonthHigh = num('high monthly inside temp');
  data.insideTempMonthLow = num('low monthly inside temp');
  data.insideTempYearHigh = num('high yearly inside temp');
  data.insideTempYearLow = num('low yearly inside temp');

  // Dew Point
  data.dewPoint = num('outside dew point');
  data.dewPointHigh = num('high dew point');
  data.dewPointLow = num('low dew point');
  data.dewPointMonthHigh = num('high monthly dew point');
  data.dewPointMonthLow = num('low monthly dew point');
  data.dewPointYearHigh = num('high yearly dew point');
  data.dewPointYearLow = num('low yearly dew point');

  // Heat Index
  data.heatIndex = num('outside heat index');
  data.heatIndexHigh = num('high heat index');
  data.heatIndexMonth = num('high monthly heat index');
  data.heatIndexYear = num('high yearly heat index');

  // Wind Chill
  data.windChill = num('wind chill');
  data.windChillLow = num('low wind chill');
  data.windChillMonth = num('low monthly wind chill');
  data.windChillYear = num('low yearly wind chill');

  // Outside Humidity
  data.outsideHum = num('outside humidity');
  data.outsideHumHigh = num('high humidity');
  data.outsideHumLow = num('low humidity');
  data.outsideHumMonthHigh = num('high monthly humidity');
  data.outsideHumMonthLow = num('low monthly humidity');
  data.outsideHumYearHigh = num('high yearly humidity');
  data.outsideHumYearLow = num('low yearly humidity');

  // Inside Humidity
  data.insideHum = num('inside humidity');
  data.insideHumHigh = num('high inside humidity');
  data.insideHumLow = num('low inside humidity');
  data.insideHumMonthHigh = num('high monthly inside humidity');
  data.insideHumMonthLow = num('low monthly inside humidity');
  data.insideHumYearHigh = num('high yearly inside humidity');
  data.insideHumYearLow = num('low yearly inside humidity');

  // Barometer
  data.barometer = num('barometer');
  data.baroTrend = get('barometer trend');
  data.baroHigh = num('high barometer');
  data.baroLow = num('low barometer');
  data.baroMonthHigh = num('high monthly barometer');
  data.baroMonthLow = num('low monthly barometer');
  data.baroYearHigh = num('high yearly barometer');
  data.baroYearLow = num('low yearly barometer');

  // Wind
  data.windSpeed = num('wind speed');
  data.windAvg = num('10 minute average wind speed');
  data.windHigh = num('high wind speed');
  data.windMonthHigh = num('high monthly wind speed');
  data.windYearHigh = num('high yearly wind speed');
  data.windDirDeg = num('wind direction in degrees');
  data.windDirSector = get('wind direction sector');

  // Rain
  data.rainTotal = num('total rain');
  data.rainDaily = num('daily rain');
  data.rainMonthly = num('monthly rain');
  data.rainStorm = num('storm rain');
  data.rainRate = num('rain rate');
  data.rainRateHigh = num('high rain rate');
  data.rainRateMonth = num('high monthly rain rate');
  data.rainRateYear = num('high yearly rain rate');

  return data;
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el && val !== null && val !== undefined) {
    el.textContent = typeof val === 'number' ? val.toFixed(1) : val;
  }
}

function setInt(id, val) {
  const el = document.getElementById(id);
  if (el && val !== null && val !== undefined) {
    el.textContent = typeof val === 'number' ? Math.round(val) : val;
  }
}

function updateUI(data) {
  // Station bar
  set('sStationName', data.stationName);
  set('sDate', data.date);
  set('sTime', data.time);
  set('sSunrise', data.sunrise);
  set('sSunset', data.sunset);

  // Outside Temp
  set('outsideTemp', data.outsideTemp);
  set('outsideTempHigh', data.outsideTempHigh != null ? data.outsideTempHigh + '°' : '--');
  set('outsideTempLow', data.outsideTempLow != null ? data.outsideTempLow + '°' : '--');
  set('outsideTempHighTime', data.outsideTempHighTime);
  set('outsideTempLowTime', data.outsideTempLowTime);
  set('outsideTempMonthHigh', data.outsideTempMonthHigh != null ? data.outsideTempMonthHigh + '°' : '--');
  set('outsideTempMonthLow', data.outsideTempMonthLow != null ? data.outsideTempMonthLow + '°' : '--');
  set('outsideTempYearHigh', data.outsideTempYearHigh != null ? data.outsideTempYearHigh + '°' : '--');
  set('outsideTempYearLow', data.outsideTempYearLow != null ? data.outsideTempYearLow + '°' : '--');

  // Thermometer bar: map temp to 0-100% (range: -5 to 50)
  if (data.outsideTemp != null) {
    const pct = Math.max(0, Math.min(100, ((data.outsideTemp + 5) / 55) * 100));
    const fill = document.querySelector('#outsideTempBar .thermo-fill');
    if (fill) fill.style.width = pct + '%';

    if (data.outsideTempHigh != null) {
      const highPct = Math.max(0, Math.min(100, ((data.outsideTempHigh + 5) / 55) * 100));
      const mark = document.getElementById('outsideTempHighMark');
      if (mark) mark.style.left = highPct + '%';
    }
    if (data.outsideTempLow != null) {
      const lowPct = Math.max(0, Math.min(100, ((data.outsideTempLow + 5) / 55) * 100));
      const mark = document.getElementById('outsideTempLowMark');
      if (mark) mark.style.left = lowPct + '%';
    }
  }

  // Inside Temp
  set('insideTemp', data.insideTemp);
  set('insideTempHigh', data.insideTempHigh != null ? data.insideTempHigh + '°' : '--');
  set('insideTempLow', data.insideTempLow != null ? data.insideTempLow + '°' : '--');
  set('insideTempMonthHigh', data.insideTempMonthHigh != null ? data.insideTempMonthHigh + '°' : '--');
  set('insideTempMonthLow', data.insideTempMonthLow != null ? data.insideTempMonthLow + '°' : '--');
  set('insideTempYearHigh', data.insideTempYearHigh != null ? data.insideTempYearHigh + '°' : '--');
  set('insideTempYearLow', data.insideTempYearLow != null ? data.insideTempYearLow + '°' : '--');

  // Dew Point
  set('dewPoint', data.dewPoint);
  set('dewPointHigh', data.dewPointHigh != null ? data.dewPointHigh + '°' : '--');
  set('dewPointLow', data.dewPointLow != null ? data.dewPointLow + '°' : '--');
  set('dewPointMonthHigh', data.dewPointMonthHigh != null ? data.dewPointMonthHigh + '°' : '--');
  set('dewPointMonthLow', data.dewPointMonthLow != null ? data.dewPointMonthLow + '°' : '--');
  set('dewPointYearHigh', data.dewPointYearHigh != null ? data.dewPointYearHigh + '°' : '--');
  set('dewPointYearLow', data.dewPointYearLow != null ? data.dewPointYearLow + '°' : '--');

  // Heat Index
  set('heatIndex', data.heatIndex);
  set('heatIndexHigh', data.heatIndexHigh != null ? data.heatIndexHigh + '°' : '--');
  set('heatIndexMonth', data.heatIndexMonth != null ? data.heatIndexMonth + '°' : '--');
  set('heatIndexYear', data.heatIndexYear != null ? data.heatIndexYear + '°' : '--');

  // Wind Chill
  set('windChill', data.windChill);
  set('windChillLow', data.windChillLow != null ? data.windChillLow + '°' : '--');
  set('windChillMonth', data.windChillMonth != null ? data.windChillMonth + '°' : '--');
  set('windChillYear', data.windChillYear != null ? data.windChillYear + '°' : '--');

  // Humidity
  set('outsideHum', data.outsideHum);
  set('outsideHumHigh', data.outsideHumHigh != null ? data.outsideHumHigh + '%' : '--');
  set('outsideHumLow', data.outsideHumLow != null ? data.outsideHumLow + '%' : '--');
  set('outsideHumMonthHigh', data.outsideHumMonthHigh != null ? data.outsideHumMonthHigh + '%' : '--');
  set('outsideHumMonthLow', data.outsideHumMonthLow != null ? data.outsideHumMonthLow + '%' : '--');
  set('outsideHumYearHigh', data.outsideHumYearHigh != null ? data.outsideHumYearHigh + '%' : '--');
  set('outsideHumYearLow', data.outsideHumYearLow != null ? data.outsideHumYearLow + '%' : '--');

  if (data.outsideHum != null) {
    const bar = document.getElementById('outsideHumBar');
    if (bar) bar.style.width = data.outsideHum + '%';
  }

  set('insideHum', data.insideHum);
  set('insideHumHigh', data.insideHumHigh != null ? data.insideHumHigh + '%' : '--');
  set('insideHumLow', data.insideHumLow != null ? data.insideHumLow + '%' : '--');
  set('insideHumMonthHigh', data.insideHumMonthHigh != null ? data.insideHumMonthHigh + '%' : '--');
  set('insideHumMonthLow', data.insideHumMonthLow != null ? data.insideHumMonthLow + '%' : '--');
  set('insideHumYearHigh', data.insideHumYearHigh != null ? data.insideHumYearHigh + '%' : '--');
  set('insideHumYearLow', data.insideHumYearLow != null ? data.insideHumYearLow + '%' : '--');

  // Barometer
  set('barometer', data.barometer);
  set('baroLow', data.baroLow != null ? data.baroLow + ' mb' : '--');
  set('baroHigh', data.baroHigh != null ? data.baroHigh + ' mb' : '--');
  set('baroMonthLow', data.baroMonthLow != null ? data.baroMonthLow.toFixed(1) : '--');
  set('baroMonthHigh', data.baroMonthHigh != null ? data.baroMonthHigh.toFixed(1) : '--');
  set('baroYearLow', data.baroYearLow != null ? data.baroYearLow.toFixed(1) : '--');
  set('baroYearHigh', data.baroYearHigh != null ? data.baroYearHigh.toFixed(1) : '--');

  // Baro trend with arrow
  const trendEl = document.getElementById('baroTrend');
  if (trendEl && data.baroTrend) {
    const trend = data.baroTrend.toLowerCase();
    let arrow = '→';
    let color = 'var(--text-muted)';
    if (trend.includes('rising')) {
      arrow = '↑';
      color = 'var(--accent-green)';
    } else if (trend.includes('falling')) {
      arrow = '↓';
      color = 'var(--accent-red)';
    }
    trendEl.innerHTML = `<span style="color:${color};font-size:1.1rem">${arrow}</span> ${data.baroTrend}`;
  }

  // Wind
  set('windSpeed', data.windSpeed);
  set('windAvg', data.windAvg);
  set('windHigh', data.windHigh != null ? data.windHigh + ' km/h' : '--');
  set('windMonthHigh', data.windMonthHigh != null ? data.windMonthHigh + ' km/h' : '--');
  set('windYearHigh', data.windYearHigh != null ? data.windYearHigh + ' km/h' : '--');

  if (data.windDirDeg != null) {
    const needle = document.getElementById('windNeedleLarge');
    if (needle) needle.style.transform = `translate(-50%, -100%) rotate(${data.windDirDeg}deg)`;
  }
  setInt('windDirDeg', data.windDirDeg);
  set('windDirSector', data.windDirSector);

  // Rain
  set('rainTotal', data.rainTotal);
  set('rainDaily', data.rainDaily != null ? data.rainDaily.toFixed(1) : '0.0');
  set('rainMonthly', data.rainMonthly != null ? data.rainMonthly.toFixed(1) : '0.0');
  set('rainStorm', data.rainStorm != null ? data.rainStorm.toFixed(1) : '0.0');
  set('rainRate', data.rainRate);
  set('rainRateHigh', data.rainRateHigh != null ? data.rainRateHigh + ' mm/hr' : '--');
  set('rainRateMonth', data.rainRateMonth != null ? data.rainRateMonth + ' mm/hr' : '--');
  set('rainRateYear', data.rainRateYear != null ? data.rainRateYear + ' mm/hr' : '--');
}

async function fetchSensorData() {
  try {
    const res = await fetch('/api/sensors');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const data = parseTagList(html);
    updateUI(data);
  } catch (err) {
    console.warn('Failed to fetch sensor data:', err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchSensorData();
  setInterval(fetchSensorData, SENSOR_REFRESH);
});
