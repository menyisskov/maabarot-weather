// Rain history page — fetch from Google Sheets and display in a sortable/filterable table

const SHEET_ID = '1AfOkRqGLd915bBpV6pRLnAKT2Ux3AXauxPaqLGBXlGE';
const GID = '231285793';
const CACHE_KEY = 'rainData';
const CACHE_TS_KEY = 'rainDataTs';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const MONTH_NAMES = [
  '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let pageSize = 100;
let sortCol = 'year';
let sortDir = 'desc';

// ── Fetch data ──────────────────────────────────────────

async function fetchSheetData() {
  // Check cache first
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedTs = localStorage.getItem(CACHE_TS_KEY);
  if (cached && cachedTs && Date.now() - Number(cachedTs) < CACHE_TTL) {
    return JSON.parse(cached);
  }

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
  const res = await fetch(url);
  const text = await res.text();

  // Response is JSONP-like: google.visualization.Query.setResponse({...})
  const jsonStr = text.match(/setResponse\(([\s\S]+)\);?$/);
  if (!jsonStr) throw new Error('Failed to parse sheet response');

  const json = JSON.parse(jsonStr[1]);
  const rows = [];

  for (const row of json.table.rows) {
    const c = row.c;
    if (!c || !c[0] || !c[1]) continue;

    const season = c[0].v || '';
    const year = c[1].v != null ? Number(c[1].v) : null;
    const month = c[2] && c[2].v != null ? Number(c[2].v) : null;
    const day = c[3] && c[3].v != null ? Number(c[3].v) : null;
    const rain = c[4] && c[4].v != null ? Number(c[4].v) : null;

    if (!season || year == null || month == null || day == null || rain == null) continue;

    rows.push({ season, year, month, day, rain });
  }

  // Cache it
  localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  localStorage.setItem(CACHE_TS_KEY, String(Date.now()));

  return rows;
}

// ── Summary stats ───────────────────────────────────────

function updateSummary(rows) {
  document.getElementById('totalRecords').textContent = rows.length.toLocaleString();

  const seasons = new Set(rows.map(r => r.season));
  document.getElementById('totalSeasons').textContent = seasons.size;

  const maxRain = Math.max(...rows.map(r => r.rain));
  const maxRow = rows.find(r => r.rain === maxRain);
  document.getElementById('maxRain').textContent = maxRain.toFixed(1);

  const years = rows.map(r => r.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  document.getElementById('dateRange').textContent = `${minYear} – ${maxYear}`;
}

// ── Extended statistics ─────────────────────────────────

function updateStatistics(rows) {
  // --- Season totals ---
  const seasonTotals = {};
  const seasonDays = {};
  for (const r of rows) {
    seasonTotals[r.season] = (seasonTotals[r.season] || 0) + r.rain;
    seasonDays[r.season] = (seasonDays[r.season] || 0) + 1;
  }

  const seasonEntries = Object.entries(seasonTotals);
  // Exclude current (potentially incomplete) season
  const sortedSeasons = [...new Set(rows.map(r => r.season))].sort();
  const currentSeason = sortedSeasons[sortedSeasons.length - 1];
  const completedSeasons = seasonEntries.filter(([s]) => s !== currentSeason);

  // Average annual rainfall
  if (completedSeasons.length > 0) {
    const totalAllSeasons = completedSeasons.reduce((s, [, v]) => s + v, 0);
    const avg = totalAllSeasons / completedSeasons.length;
    document.getElementById('avgAnnual').textContent = avg.toFixed(1);
  }

  // Average rain per rainy day
  const totalRain = rows.reduce((s, r) => s + r.rain, 0);
  document.getElementById('avgPerDay').textContent = (totalRain / rows.length).toFixed(1);

  // Average rainy days per season
  const allSeasonDayValues = Object.values(seasonDays);
  const avgDays = allSeasonDayValues.reduce((s, v) => s + v, 0) / allSeasonDayValues.length;
  document.getElementById('avgRainyDays').textContent = avgDays.toFixed(0);

  // Wettest season
  if (completedSeasons.length > 0) {
    const wettest = completedSeasons.reduce((a, b) => a[1] > b[1] ? a : b);
    document.getElementById('wettestSeason').textContent = wettest[0];
    document.getElementById('wettestSeasonDetail').textContent = `${wettest[1].toFixed(1)} מ"מ`;
  }

  // Driest season
  if (completedSeasons.length > 0) {
    const driest = completedSeasons.reduce((a, b) => a[1] < b[1] ? a : b);
    document.getElementById('driestSeason').textContent = driest[0];
    document.getElementById('driestSeasonDetail').textContent = `${driest[1].toFixed(1)} מ"מ`;
  }

  // Max single day
  const maxRow = rows.reduce((a, b) => a.rain > b.rain ? a : b);
  document.getElementById('maxDayValue').textContent = `${maxRow.rain.toFixed(1)} מ"מ`;
  document.getElementById('maxDayDetail').textContent =
    `${String(maxRow.day).padStart(2, '0')}/${String(maxRow.month).padStart(2, '0')}/${maxRow.year}`;

  // --- Monthly average breakdown ---
  const monthlyTotals = {};
  const monthlyYears = {};
  for (const r of rows) {
    if (!monthlyTotals[r.month]) {
      monthlyTotals[r.month] = 0;
      monthlyYears[r.month] = new Set();
    }
    monthlyTotals[r.month] += r.rain;
    monthlyYears[r.month].add(r.year);
  }

  const monthlyAvg = {};
  let maxMonthAvg = 0;
  for (let m = 1; m <= 12; m++) {
    if (monthlyTotals[m] && monthlyYears[m]) {
      monthlyAvg[m] = monthlyTotals[m] / monthlyYears[m].size;
      maxMonthAvg = Math.max(maxMonthAvg, monthlyAvg[m]);
    } else {
      monthlyAvg[m] = 0;
    }
  }

  const barsContainer = document.getElementById('monthlyBars');
  // Rain season order: Oct, Nov, Dec, Jan, Feb, Mar, Apr, May (skip summer)
  const rainMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let barsHtml = '';
  for (const m of rainMonths) {
    const avg = monthlyAvg[m] || 0;
    const pct = maxMonthAvg > 0 ? (avg / maxMonthAvg) * 100 : 0;
    const barColor = avg > 80 ? 'var(--accent-blue)' :
                     avg > 30 ? 'var(--accent-cyan)' :
                     avg > 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.05)';
    barsHtml += `
      <div class="month-bar-col">
        <div class="month-bar-value">${avg > 0 ? avg.toFixed(0) : ''}</div>
        <div class="month-bar-track">
          <div class="month-bar-fill" style="height:${pct}%;background:${barColor}"></div>
        </div>
        <div class="month-bar-label">${MONTH_NAMES[m].slice(0, 3)}</div>
      </div>`;
  }
  barsContainer.innerHTML = barsHtml;

  // --- Top 10 rainiest days ---
  const sorted = [...rows].sort((a, b) => b.rain - a.rain).slice(0, 10);
  const topContainer = document.getElementById('topDaysList');
  let topHtml = '';
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const dateStr = `${String(r.day).padStart(2, '0')}/${String(r.month).padStart(2, '0')}/${r.year}`;
    const barPct = (r.rain / sorted[0].rain) * 100;
    topHtml += `
      <div class="top-day-row">
        <span class="top-day-rank">${i + 1}</span>
        <span class="top-day-date">${dateStr}</span>
        <span class="top-day-season">${r.season}</span>
        <div class="top-day-bar-track">
          <div class="top-day-bar-fill" style="width:${barPct}%"></div>
        </div>
        <span class="top-day-value">${r.rain.toFixed(1)} מ"מ</span>
      </div>`;
  }
  topContainer.innerHTML = topHtml;
}

// ── Season filter options ───────────────────────────────

function populateSeasonFilter(rows) {
  const seasons = [...new Set(rows.map(r => r.season))];
  // Sort descending (newest first)
  seasons.sort((a, b) => b.localeCompare(a));

  const sel = document.getElementById('seasonFilter');
  for (const s of seasons) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
}

// ── Filtering ───────────────────────────────────────────

function applyFilters() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const seasonVal = document.getElementById('seasonFilter').value;
  const monthVal = document.getElementById('monthFilter').value;

  filteredRows = allRows.filter(r => {
    if (seasonVal && r.season !== seasonVal) return false;
    if (monthVal && r.month !== Number(monthVal)) return false;
    if (search) {
      const dateStr = `${r.day}/${r.month}/${r.year}`;
      const hay = `${r.season} ${r.year} ${r.month} ${r.day} ${r.rain} ${dateStr} ${MONTH_NAMES[r.month] || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  applySorting();
  currentPage = 1;
  renderTable();
  updateRowCount();
}

// ── Sorting ─────────────────────────────────────────────

function applySorting() {
  filteredRows.sort((a, b) => {
    let va = a[sortCol];
    let vb = b[sortCol];

    // For season, compare as string
    if (sortCol === 'season') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }

    // Numeric
    if (va === vb) {
      // Secondary sort: by year desc, month desc, day desc
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return b.day - a.day;
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });
}

function handleSort(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = col === 'season' ? 'asc' : 'desc';
  }

  // Update header classes
  document.querySelectorAll('.data-table th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  const activeTh = document.querySelector(`.data-table th[data-col="${col}"]`);
  if (activeTh) activeTh.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');

  applySorting();
  renderTable();
}

// ── Rain color coding ───────────────────────────────────

function rainClass(mm) {
  if (mm >= 50) return 'rain-extreme';
  if (mm >= 20) return 'rain-heavy';
  if (mm >= 5) return 'rain-moderate';
  return 'rain-light';
}

function rainBarColor(mm) {
  if (mm >= 50) return 'var(--accent-red)';
  if (mm >= 20) return 'var(--accent-amber)';
  if (mm >= 5) return 'var(--accent-blue)';
  return 'var(--accent-cyan)';
}

// ── Table rendering ─────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const page = filteredRows.slice(start, end);

  // Find max rain in dataset for bar scaling (cap at 150mm)
  const maxRainForBar = 150;

  let html = '';
  for (const r of page) {
    const barPct = Math.min(100, (r.rain / maxRainForBar) * 100);
    const cls = rainClass(r.rain);
    const barColor = rainBarColor(r.rain);
    const dateStr = `${String(r.day).padStart(2, '0')}/${String(r.month).padStart(2, '0')}/${r.year}`;

    html += `<tr>
      <td>${r.season}</td>
      <td>${r.year}</td>
      <td>${MONTH_NAMES[r.month] || r.month}</td>
      <td>${r.day}</td>
      <td class="rain-bar-cell">
        <span class="rain-cell ${cls}">${r.rain.toFixed(1)}</span>
        <span class="rain-mini-bar">
          <span class="rain-mini-bar-fill" style="width:${barPct}%;background:${barColor}"></span>
        </span>
      </td>
      <td class="date-cell">${dateStr}</td>
    </tr>`;
  }

  tbody.innerHTML = html;
  updatePagination();
}

// ── Pagination ──────────────────────────────────────────

function updatePagination() {
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  document.getElementById('pageInfo').textContent = `עמוד ${currentPage} מתוך ${totalPages}`;
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function updateRowCount() {
  const el = document.getElementById('rowCount');
  if (filteredRows.length === allRows.length) {
    el.textContent = `${allRows.length.toLocaleString()} שורות`;
  } else {
    el.textContent = `${filteredRows.length.toLocaleString()} מתוך ${allRows.length.toLocaleString()}`;
  }
}

// ── CSV Export ───────────────────────────────────────────

function exportCSV() {
  const header = 'Season,Year,Month,Day,Rain (mm),Date\n';
  const csvRows = filteredRows.map(r => {
    const dateStr = `${String(r.day).padStart(2, '0')}/${String(r.month).padStart(2, '0')}/${r.year}`;
    return `${r.season},${r.year},${r.month},${r.day},${r.rain},${dateStr}`;
  });

  const blob = new Blob(['\uFEFF' + header + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maabarot-rain-data.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Cumulative Rain Graph ────────────────────────────────

// Rain season runs Oct 1 → Sep 30.  "Day of season" = days since Oct 1.
// Months in season order: Oct(10), Nov(11), Dec(12), Jan(1)…Sep(9)
const SEASON_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SEASON_MONTH_LABELS = ['אוק', 'נוב', 'דצמ', 'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט'];

function dayOfSeason(month, day) {
  // Oct 1 = day 0.  We use a non-leap reference year for consistent spacing.
  const ref = month >= 10 ? 2001 : 2002; // Oct-Dec in 2001, Jan-Sep in 2002
  const d = new Date(ref, month - 1, day);
  const oct1 = new Date(2001, 9, 1); // Oct 1 2001
  return Math.floor((d - oct1) / 86400000);
}

const SEASON_DAYS = 365; // Oct 1 → Sep 30

function populateSeasonSelect(rows) {
  const seasons = [...new Set(rows.map(r => r.season))].sort((a, b) => b.localeCompare(a));
  const sel = document.getElementById('graphSeasonSelect');
  for (const s of seasons) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  if (seasons.length > 0) sel.value = seasons[0];
}

// Build multi-year average cumulative curve (per day-of-season)
function buildAverageCurve(rows) {
  // Group rows by season, compute cumulative per season
  const seasons = {};
  for (const r of rows) {
    if (!seasons[r.season]) seasons[r.season] = [];
    seasons[r.season].push(r);
  }

  // For each completed season, build a map: dayOfSeason → cumulative
  const allSeasonKeys = Object.keys(seasons).sort();
  // Exclude the latest (potentially incomplete) season
  const currentSeason = allSeasonKeys[allSeasonKeys.length - 1];
  const completedKeys = allSeasonKeys.filter(s => s !== currentSeason);

  if (completedKeys.length === 0) return [];

  // For each day-of-season (0–364), accumulate totals across seasons
  const daySums = new Float64Array(SEASON_DAYS);
  const dayCounts = new Uint16Array(SEASON_DAYS);

  for (const sKey of completedKeys) {
    const sRows = seasons[sKey].sort((a, b) => dayOfSeason(a.month, a.day) - dayOfSeason(b.month, b.day));
    let cum = 0;
    let lastDos = -1;
    for (const r of sRows) {
      cum += r.rain;
      const dos = dayOfSeason(r.month, r.day);
      // Fill forward: for days between lastDos+1 and dos, carry the cumulative
      for (let d = Math.max(0, lastDos + 1); d <= dos && d < SEASON_DAYS; d++) {
        daySums[d] += cum;
        dayCounts[d]++;
      }
      lastDos = dos;
    }
    // Fill to end of season with final cumulative
    for (let d = lastDos + 1; d < SEASON_DAYS; d++) {
      daySums[d] += cum;
      dayCounts[d]++;
    }
  }

  // Build average curve — only include points where we have data
  const avgPoints = [];
  for (let d = 0; d < SEASON_DAYS; d++) {
    if (dayCounts[d] > 0) {
      avgPoints.push({ dos: d, cumulative: daySums[d] / dayCounts[d] });
    }
  }
  return avgPoints;
}

function buildCumulativeGraph(rows, season, avgCurve) {
  const canvas = document.getElementById('cumulativeCanvas');
  const wrapper = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  const rect = wrapper.getBoundingClientRect();
  const width = rect.width;
  const height = Math.min(380, Math.max(240, width * 0.4));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Filter and sort data for selected season
  const seasonRows = rows
    .filter(r => r.season === season)
    .sort((a, b) => dayOfSeason(a.month, a.day) - dayOfSeason(b.month, b.day));

  if (seasonRows.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px Heebo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('אין נתונים לעונה זו', width / 2, height / 2);
    return;
  }

  // Build cumulative points
  const points = [];
  let cumulative = 0;
  for (const r of seasonRows) {
    cumulative += r.rain;
    points.push({ dos: dayOfSeason(r.month, r.day), cumulative, rain: r.rain, month: r.month, day: r.day });
  }

  // Chart dimensions
  const pad = { top: 30, right: 30, bottom: 45, left: 55 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Y-max: fit both the season line and the average curve
  const maxSeasonCum = points[points.length - 1].cumulative;
  const maxAvgCum = avgCurve.length > 0 ? avgCurve[avgCurve.length - 1].cumulative : 0;
  const yMax = Math.ceil(Math.max(maxSeasonCum, maxAvgCum) / 50) * 50 || 50;

  const xMin = 0;
  const xMax = SEASON_DAYS;

  function xPos(dos) { return pad.left + ((dos - xMin) / (xMax - xMin)) * chartW; }
  function yPos(val) { return pad.top + chartH - (val / yMax) * chartH; }

  // Gridlines + Y-axis labels
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const val = (yMax / ySteps) * i;
    const y = yPos(val);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Heebo, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(val) + '', pad.left - 8, y + 4);
  }

  // Month labels on X-axis (season order)
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px Heebo, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < SEASON_MONTHS.length; i++) {
    const m = SEASON_MONTHS[i];
    const dos = dayOfSeason(m, 1);
    const x = xPos(dos);
    if (x >= pad.left && x <= width - pad.right) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + chartH);
      ctx.stroke();
      ctx.fillText(SEASON_MONTH_LABELS[i], x + 12, pad.top + chartH + 16);
    }
  }

  // Y-axis title
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '11px Heebo, sans-serif';
  ctx.textAlign = 'center';
  ctx.translate(14, pad.top + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('מ"מ מצטבר', 0, 0);
  ctx.restore();

  // ── Average curve (dashed, drawn first so season line is on top) ──
  if (avgCurve.length > 1) {
    // Area fill
    ctx.beginPath();
    ctx.moveTo(xPos(avgCurve[0].dos), yPos(0));
    for (const p of avgCurve) ctx.lineTo(xPos(p.dos), yPos(p.cumulative));
    ctx.lineTo(xPos(avgCurve[avgCurve.length - 1].dos), yPos(0));
    ctx.closePath();
    const avgGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    avgGrad.addColorStop(0, 'rgba(251, 191, 36, 0.08)');
    avgGrad.addColorStop(1, 'rgba(251, 191, 36, 0.01)');
    ctx.fillStyle = avgGrad;
    ctx.fill();

    // Dashed line
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (let i = 0; i < avgCurve.length; i++) {
      const x = xPos(avgCurve[i].dos);
      const y = yPos(avgCurve[i].cumulative);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Average total label
    const lastAvg = avgCurve[avgCurve.length - 1];
    ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.font = '11px Heebo, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ממוצע ' + lastAvg.cumulative.toFixed(0) + ' מ"מ', xPos(lastAvg.dos) + 4, yPos(lastAvg.cumulative) + 14);
  }

  // ── Season area fill ──
  ctx.beginPath();
  ctx.moveTo(xPos(points[0].dos), yPos(0));
  for (const p of points) ctx.lineTo(xPos(p.dos), yPos(p.cumulative));
  ctx.lineTo(xPos(points[points.length - 1].dos), yPos(0));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Season line ──
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (let i = 0; i < points.length; i++) {
    const x = xPos(points[i].dos);
    const y = yPos(points[i].cumulative);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Data points
  if (points.length <= 80) {
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(xPos(p.dos), yPos(p.cumulative), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 1)';
      ctx.fill();
    }
  }

  // Season total label
  const lastP = points[points.length - 1];
  ctx.fillStyle = 'rgba(56, 189, 248, 1)';
  ctx.font = 'bold 12px Heebo, sans-serif';
  ctx.textAlign = 'left';
  const totalX = xPos(lastP.dos) + 6;
  const totalY = yPos(lastP.cumulative) - 6;
  ctx.fillText(lastP.cumulative.toFixed(1) + ' מ"מ', totalX > width - 80 ? xPos(lastP.dos) - 70 : totalX, totalY < pad.top + 15 ? totalY + 20 : totalY);
}

// ── Init ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('tableLoading');

  try {
    allRows = await fetchSheetData();
    filteredRows = [...allRows];

    updateSummary(allRows);
    updateStatistics(allRows);
    populateSeasonFilter(allRows);
    populateSeasonSelect(allRows);

    // Build average curve once, reuse for all season graphs
    const avgCurve = buildAverageCurve(allRows);

    // Build graph for default season
    const graphSeasonSel = document.getElementById('graphSeasonSelect');
    if (graphSeasonSel.value) {
      buildCumulativeGraph(allRows, graphSeasonSel.value, avgCurve);
    }
    graphSeasonSel.addEventListener('change', () => {
      buildCumulativeGraph(allRows, graphSeasonSel.value, avgCurve);
    });
    // Redraw on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (graphSeasonSel.value) buildCumulativeGraph(allRows, graphSeasonSel.value, avgCurve);
      }, 200);
    });

    // Default sort: newest first
    applySorting();
    renderTable();
    updateRowCount();

    // Set default sort indicator
    const defaultTh = document.querySelector('.data-table th[data-col="year"]');
    if (defaultTh) defaultTh.classList.add('sort-desc');

    loading.classList.add('hidden');

    // Show last fetch time
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (ts) {
      const d = new Date(Number(ts));
      document.getElementById('lastFetch').textContent = `עדכון אחרון: ${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    loading.innerHTML = `<span style="color: var(--accent-red)">שגיאה בטעינת נתונים: ${err.message}</span>`;
    console.error('Failed to load rain data:', err);
  }

  // Event listeners
  document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('seasonFilter').addEventListener('change', applyFilters);
  document.getElementById('monthFilter').addEventListener('change', applyFilters);

  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.col));
  });

  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRows.length / pageSize);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
  });

  document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage = 1;
    renderTable();
  });

  document.getElementById('exportBtn').addEventListener('click', exportCSV);
});

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
