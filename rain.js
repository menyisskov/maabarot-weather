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

// ── Init ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('tableLoading');

  try {
    allRows = await fetchSheetData();
    filteredRows = [...allRows];

    updateSummary(allRows);
    updateStatistics(allRows);
    populateSeasonFilter(allRows);

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
