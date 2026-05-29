// =============================================================================
// core.js — Shared infrastructure for Beyond GDP HLEG Dashboard
// HLEG Tier I exclusive — 20 UN HLEG indicators, 4 components.
// Sister project: Beyond GDP Project (34-card analytical version).
//
// Contains:
//   - Theme tokens, data cache, normalization helpers
//   - computeHLEGAggregate (Option A score, HLEG Tier I only)
//   - computeComponentStatus (4 HLEG components for landing hub)
//   - Country selector, tooltip drawer, theme toggle, URL helpers
//   - All 20 Tier I render functions (19 live + 1 loneliness no-data)
//   - Tooltip update functions for each component page
// =============================================================================

// ── Theme tokens for ECharts (read live from CSS vars) ───────────────────────
function chartTokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, fallback) => (cs.getPropertyValue(n).trim() || fallback);
  return {
    text:     v('--chart-text',      '#e6e8f2'),
    textMid:  v('--chart-text-mid',  '#adb1c8'),
    textLow:  v('--chart-text-low',  '#8b8fa8'),
    grid:     v('--chart-grid',      'rgba(255,255,255,0.18)'),
    gridSoft: v('--chart-grid-soft', 'rgba(255,255,255,0.06)'),
    needleBorder: v('--chart-needle-border', '#141828'),
    red:      v('--red',             '#ef4444'),
  };
}

// ── Data cache ────────────────────────────────────────────────────────────────
const Cache = {};
window.CoreCache = Cache; // expose for aggregates.js on hub page

async function loadAll(extraFiles = []) {
  const files = [
    'countries',
    // Foundational (3)
    'ipv', 'ghg_total', 'bii',
    // Current well-being (9)
    'household_income', 'lu4', 'hale', 'lbw', 'learning_outcomes',
    'homicide_rate', 'life_satisfaction', 'loneliness', 'pm25', 'drinking_water',
    // Equality & inclusion (3)
    'gini', 'poverty_societal', 'gender_pay_ratio',
    // Sustainability & resilience (4)
    'produced_capital', 'neet', 'wvs_gov_confidence', 'wvs_trust',
    ...extraFiles,
  ];
  await Promise.all(files.map(async (name) => {
    const res = await fetch(`data/${name}.json`);
    Cache[name] = await res.json();
  }));
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null || !isFinite(n)) return 'N/A';
  return Number(n).toFixed(decimals);
}
function fmtBillion(n) {
  if (n == null || !isFinite(n)) return 'N/A';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(0) + 'M';
  return n.toFixed(0);
}
function fmtGni(n) {
  if (n == null || !isFinite(n)) return 'N/A';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
  return '$' + Math.round(n);
}

// ── No-data overlay helpers ───────────────────────────────────────────────────
function showNoData(el, chart) {
  if (chart) chart.setOption({ series: [] }, true);
  let ov = el.querySelector(':scope > .metric-nodata');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'metric-nodata';
    ov.innerHTML = '<div class="nd-icon">&#9680;</div><span>No data available</span>';
    el.appendChild(ov);
  }
  ov.style.display = 'flex';
}
function hideNoData(el) {
  const ov = el.querySelector(':scope > .metric-nodata');
  if (ov) ov.style.display = 'none';
}

// ── Zone helpers ──────────────────────────────────────────────────────────────
function makeZones(min, max, zoneDefs) {
  const total = max - min;
  return zoneDefs.map(z => [(z.maxVal - min) / total, z.color]);
}

// ── Status badge helpers ──────────────────────────────────────────────────────
function setStatus(id, level, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const classMap = {
    green: 'status-green', 'green-dark': 'status-green-dark',
    amber: 'status-amber', red: 'status-red', gray: 'status-gray',
  };
  const labelMap = {
    green: 'On Target', 'green-dark': 'Net Sink',
    amber: 'Caution', red: 'Overshoot', gray: 'No Data',
  };
  el.className = 'status-badge ' + (classMap[level] || 'status-gray');
  el.textContent = label || labelMap[level] || '—';

  const cardEl = el.closest('[data-card]');
  if (cardEl) {
    cardEl.classList.remove('card-danger', 'card-amber', 'card-safe', 'card-sink', 'card-gray');
    const cardClassMap = {
      green: 'card-safe', 'green-dark': 'card-sink',
      amber: 'card-amber', red: 'card-danger', gray: 'card-gray',
    };
    if (cardClassMap[level]) cardEl.classList.add(cardClassMap[level]);
  }
}

// ── Bullet builder ────────────────────────────────────────────────────────────
function buildBulletOption({ value, min, max, zones, unitLabel, formatFn, vsText, vsColor, overflow, dangerMarkLine }) {
  const tk = chartTokens();
  const clampedValue = Math.max(min, Math.min(max, value));
  const valueColor = tk.text;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const zoneOpacity = isLight ? 0.55 : 0.42;

  const range = max - min;
  const zoneAreas = [];
  let prev = 0;
  for (const z of zones) {
    const pos = Array.isArray(z) ? z[0] : (z.maxVal - min) / range;
    const color = Array.isArray(z) ? z[1] : z.color;
    if (pos > prev) {
      zoneAreas.push([
        { xAxis: min + prev * range, itemStyle: { color, opacity: zoneOpacity } },
        { xAxis: min + pos * range },
      ]);
    }
    prev = pos;
  }

  return {
    backgroundColor: 'transparent',
    tooltip: { show: false, trigger: 'none', triggerOn: 'none' },
    axisPointer: { show: false },
    animation: true,
    animationDuration: 450,
    animationEasingUpdate: 'cubicOut',
    grid: { left: 14, right: 14, top: 36, bottom: 26, containLabel: false },
    xAxis: {
      type: 'value',
      min, max,
      splitNumber: 4,
      axisPointer: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: tk.textLow,
        fontSize: 10,
        hideOverlap: true,
        formatter: v => {
          const abs = Math.abs(v);
          if (abs >= 1000) return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k';
          if (abs >= 10) return String(Math.round(v));
          if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
          return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
        },
      },
    },
    yAxis: {
      type: 'category',
      data: [''],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        silent: true,
        emphasis: { disabled: true },
        data: [clampedValue],
        itemStyle: { color: valueColor, borderRadius: 2 },
        label: {
          show: true,
          position: 'top',
          color: valueColor,
          fontSize: 14,
          fontWeight: 600,
          formatter: () => (formatFn ? formatFn(value) : String(value)) + (overflow ? ' +' : ''),
          distance: 6,
        },
        markLine: (() => {
          const boundaries = zoneAreas.slice(0, -1).map(area => ({
            xAxis: area[1].xAxis,
            lineStyle: { color: tk.grid, width: 1, type: 'solid' },
            label: {
              show: true,
              position: 'end',
              formatter: p => {
                const v = p.value;
                const abs = Math.abs(v);
                if (abs >= 1000) return (v / 1000).toFixed(1) + 'k';
                if (abs >= 10) return String(Math.round(v));
                return v.toFixed(abs >= 1 ? 1 : 2);
              },
              color: tk.textLow,
              fontSize: 9,
              distance: 2,
            },
          }));
          if (dangerMarkLine != null) {
            boundaries.push({
              xAxis: dangerMarkLine,
              lineStyle: { color: tk.red, width: 2, type: 'dashed' },
              label: { show: false },
            });
          }
          if (overflow) {
            boundaries.push({
              xAxis: max,
              lineStyle: { color: tk.red, width: 2, type: 'solid' },
              label: { show: false },
            });
          }
          return {
            silent: true,
            symbol: boundaries.map((_, i) => overflow && i === boundaries.length - 1 ? 'arrow' : 'none'),
            symbolSize: [6, 8],
            data: boundaries,
          };
        })(),
        markArea: {
          silent: true,
          itemStyle: { borderWidth: 0 },
          emphasis: { disabled: true },
          data: zoneAreas,
        },
        z: 3,
      },
    ],
  };
}

// ── HLEG Tier I aggregate composite (Option A) ───────────────────────────────
// Computes an inequality-adjusted income score from the 20 Tier I indicators.
// Used as the apex stat on the landing page.
function computeHLEGAggregate(iso3) {
  function normHigh(val, bad, mid, good) {
    if (val == null || !isFinite(val)) return null;
    if (val <= bad)  return 0;
    if (val <= mid)  return 50 * (val - bad) / (mid - bad);
    if (val <= good) return 50 + 50 * (val - mid) / (good - mid);
    return 100;
  }
  function normLow(val, good, mid, bad) {
    if (val == null || !isFinite(val)) return null;
    if (val <= good) return 100;
    if (val <= mid)  return 50 + 50 * (mid - val) / (mid - good);
    if (val <= bad)  return 50 * (bad - val) / (bad - mid);
    return 0;
  }

  // Foundational (3)
  const ipv  = normLow(Cache.ipv?.data?.[iso3]?.value,  5, 10, 25);
  const ghg  = normLow(Cache.ghg_total?.data?.[iso3]?.value, 100, 300, 1000);
  const bii  = normHigh(Cache.bii?.data?.[iso3]?.value, 70, 85, 95);

  // Current well-being (9; loneliness excluded — no open data)
  const hhinc  = normHigh(Cache.household_income?.data?.[iso3]?.value, 1000, 12000, 80000);
  const lu4    = normLow(Cache.lu4?.data?.[iso3]?.value, 5, 10, 25);
  const hale   = normHigh(Cache.hale?.data?.[iso3]?.value, 50, 65, 75);
  const lbw    = normLow(Cache.lbw?.data?.[iso3]?.value, 7, 10, 15);
  const lo     = normHigh(Cache.learning_outcomes?.data?.[iso3]?.value, 420, 490, 570);
  const hm     = normLow(Cache.homicide_rate?.data?.[iso3]?.value, 3, 6, 10);
  const ls     = normHigh(Cache.life_satisfaction?.data?.[iso3]?.value, 3.5, 5.5, 7.5);
  const pm25   = normLow(Cache.pm25?.data?.[iso3]?.value, 5, 15, 35);
  const water  = normHigh(Cache.drinking_water?.data?.[iso3]?.value, 50, 75, 95);

  // Equality & inclusion (3)
  const gini  = normLow(Cache.gini?.data?.[iso3]?.value, 25, 37, 55);
  const pov   = normLow(Cache.poverty_societal?.data?.[iso3]?.value, 5, 15, 35);
  const gpr   = normHigh(Cache.gender_pay_ratio?.data?.[iso3]?.value, 0.70, 0.85, 0.95);

  // Sustainability & resilience (4)
  const cap   = normHigh(Cache.produced_capital?.data?.[iso3]?.value, 10000, 50000, 120000);
  const neet  = normLow(Cache.neet?.data?.[iso3]?.value, 10, 15, 30);
  const gc    = normHigh(Cache.wvs_gov_confidence?.data?.[iso3]?.value, 30, 45, 65);
  const tr    = normHigh(Cache.wvs_trust?.data?.[iso3]?.value, 15, 25, 50);

  const all = [ipv, ghg, bii, hhinc, lu4, hale, lbw, lo, hm, ls, pm25, water, gini, pov, gpr, cap, neet, gc, tr];
  const valid = all.filter(v => v != null);
  if (!valid.length) return null;

  const score = valid.reduce((a, b) => a + b, 0) / valid.length;
  return { score, indicatorCount: valid.length, indicatorTotal: 19 }; // loneliness excluded
}

// ── HLEG component status (for landing hub) ──────────────────────────────────
function computeComponentStatus(iso3, component) {
  function normHigh(val, bad, mid, good) {
    if (val == null || !isFinite(val)) return null;
    if (val <= bad)  return 0;
    if (val <= mid)  return 50 * (val - bad) / (mid - bad);
    if (val <= good) return 50 + 50 * (val - mid) / (good - mid);
    return 100;
  }
  function normLow(val, good, mid, bad) {
    if (val == null || !isFinite(val)) return null;
    if (val <= good) return 100;
    if (val <= mid)  return 50 + 50 * (mid - val) / (mid - good);
    if (val <= bad)  return 50 * (bad - val) / (bad - mid);
    return 0;
  }

  let indicators = [];
  switch (component) {
    case 'foundational': {
      indicators = [
        normLow(Cache.ipv?.data?.[iso3]?.value,       5, 10, 25),
        normLow(Cache.ghg_total?.data?.[iso3]?.value, 100, 300, 1000),
        normHigh(Cache.bii?.data?.[iso3]?.value,       70, 85, 95),
      ];
      break;
    }
    case 'wellbeing': {
      // 8 of 9 — loneliness excluded (no open data)
      indicators = [
        normHigh(Cache.household_income?.data?.[iso3]?.value, 1000, 12000, 80000),
        normLow(Cache.lu4?.data?.[iso3]?.value,               5, 10, 25),
        normHigh(Cache.hale?.data?.[iso3]?.value,             50, 65, 75),
        normLow(Cache.lbw?.data?.[iso3]?.value,               7, 10, 15),
        normHigh(Cache.learning_outcomes?.data?.[iso3]?.value, 420, 490, 570),
        normLow(Cache.homicide_rate?.data?.[iso3]?.value,     3, 6, 10),
        normHigh(Cache.life_satisfaction?.data?.[iso3]?.value, 3.5, 5.5, 7.5),
        normLow(Cache.pm25?.data?.[iso3]?.value,              5, 15, 35),
        normHigh(Cache.drinking_water?.data?.[iso3]?.value,   50, 75, 95),
      ];
      break;
    }
    case 'equality': {
      indicators = [
        normLow(Cache.gini?.data?.[iso3]?.value,               25, 37, 55),
        normLow(Cache.poverty_societal?.data?.[iso3]?.value,   5, 15, 35),
        normHigh(Cache.gender_pay_ratio?.data?.[iso3]?.value,  0.70, 0.85, 0.95),
      ];
      break;
    }
    case 'sustainability': {
      indicators = [
        normHigh(Cache.produced_capital?.data?.[iso3]?.value,      10000, 50000, 120000),
        normLow(Cache.neet?.data?.[iso3]?.value,                   10, 15, 30),
        normHigh(Cache.wvs_gov_confidence?.data?.[iso3]?.value,    30, 45, 65),
        normHigh(Cache.wvs_trust?.data?.[iso3]?.value,             15, 25, 50),
      ];
      break;
    }
    default:
      return { score: null, level: 'gray', counted: 0, total: 0 };
  }

  const counted = indicators.filter(v => v != null).length;
  const total   = indicators.length;
  if (counted === 0 || counted < total * 0.5) {
    return { score: null, level: 'gray', counted, total };
  }
  const score = indicators.filter(v => v != null).reduce((a, b) => a + b, 0) / counted;
  const level = score >= 67 ? 'green' : score >= 33 ? 'amber' : 'red';
  return { score, level, counted, total };
}

// ── Country meta ──────────────────────────────────────────────────────────────
function updateMeta(iso3) {
  const countries = Cache.countries?.countries || [];
  const entry = countries.find(c => c.iso3 === iso3);

  const regionEl = document.getElementById('meta-region');
  const incomeEl = document.getElementById('meta-income');
  if (regionEl) regionEl.textContent = entry?.region ? `Region: ${entry.region}` : '';
  if (incomeEl) incomeEl.textContent = entry?.income_group ? `Income: ${entry.income_group}` : '';
}

// ── Country flag ──────────────────────────────────────────────────────────────
const ISO3_TO_ISO2 = {
  AFG:'af',ALB:'al',DZA:'dz',AND:'ad',AGO:'ao',ATG:'ag',ARG:'ar',ARM:'am',
  AUS:'au',AUT:'at',AZE:'az',BHS:'bs',BHR:'bh',BGD:'bd',BRB:'bb',BLR:'by',
  BEL:'be',BLZ:'bz',BEN:'bj',BTN:'bt',BOL:'bo',BIH:'ba',BWA:'bw',BRA:'br',
  BRN:'bn',BGR:'bg',BFA:'bf',BDI:'bi',CPV:'cv',KHM:'kh',CMR:'cm',CAN:'ca',
  CAF:'cf',TCD:'td',CHL:'cl',CHN:'cn',COL:'co',COM:'km',COD:'cd',COG:'cg',
  CRI:'cr',CIV:'ci',HRV:'hr',CUB:'cu',CYP:'cy',CZE:'cz',DNK:'dk',DJI:'dj',
  DOM:'do',ECU:'ec',EGY:'eg',SLV:'sv',GNQ:'gq',ERI:'er',EST:'ee',SWZ:'sz',
  ETH:'et',FJI:'fj',FIN:'fi',FRA:'fr',GAB:'ga',GMB:'gm',GEO:'ge',DEU:'de',
  GHA:'gh',GRC:'gr',GTM:'gt',GIN:'gn',GNB:'gw',GUY:'gy',HTI:'ht',HND:'hn',
  HUN:'hu',ISL:'is',IND:'in',IDN:'id',IRN:'ir',IRQ:'iq',IRL:'ie',ISR:'il',
  ITA:'it',JAM:'jm',JPN:'jp',JOR:'jo',KAZ:'kz',KEN:'ke',PRK:'kp',KOR:'kr',
  KWT:'kw',KGZ:'kg',LAO:'la',LVA:'lv',LBN:'lb',LSO:'ls',LBR:'lr',LBY:'ly',
  LIE:'li',LTU:'lt',LUX:'lu',MDG:'mg',MWI:'mw',MYS:'my',MDV:'mv',MLI:'ml',
  MLT:'mt',MRT:'mr',MUS:'mu',MEX:'mx',MDA:'md',MCO:'mc',MNG:'mn',MNE:'me',
  MAR:'ma',MOZ:'mz',MMR:'mm',NAM:'na',NPL:'np',NLD:'nl',NZL:'nz',NIC:'ni',
  NER:'ne',NGA:'ng',MKD:'mk',NOR:'no',OMN:'om',PAK:'pk',PAN:'pa',PNG:'pg',
  PRY:'py',PER:'pe',PHL:'ph',POL:'pl',PRT:'pt',QAT:'qa',ROU:'ro',RUS:'ru',
  RWA:'rw',WSM:'ws',SAU:'sa',SEN:'sn',SRB:'rs',SLE:'sl',SGP:'sg',SVK:'sk',
  SVN:'si',SLB:'sb',SOM:'so',ZAF:'za',SSD:'ss',ESP:'es',LKA:'lk',SDN:'sd',
  SUR:'sr',SWE:'se',CHE:'ch',SYR:'sy',TJK:'tj',TZA:'tz',THA:'th',
  TLS:'tl',TGO:'tg',TON:'to',TTO:'tt',TUN:'tn',TUR:'tr',TKM:'tm',UGA:'ug',
  UKR:'ua',ARE:'ae',GBR:'gb',USA:'us',URY:'uy',UZB:'uz',VUT:'vu',VEN:'ve',
  VNM:'vn',YEM:'ye',ZMB:'zm',ZWE:'zw',STP:'st',DMA:'dm',GRD:'gd',KIR:'ki',
  MHL:'mh',FSM:'fm',NRU:'nr',PLW:'pw',KNA:'kn',LCA:'lc',VCT:'vc',TUV:'tv',
  PSE:'ps',HKG:'hk',MAC:'mo',GRL:'gl',FRO:'fo',NCL:'nc',PYF:'pf',
  CUW:'cw',ABW:'aw',MTQ:'mq',GUF:'gf',REU:'re',MYT:'yt',SPM:'pm',
};

function updateFlag(iso3) {
  const flagEl = document.getElementById('country-flag');
  if (!flagEl) return;
  const iso2 = ISO3_TO_ISO2[iso3];
  if (iso2) {
    flagEl.src = `https://flagcdn.com/24x18/${iso2}.png`;
    flagEl.style.display = 'inline-block';
  } else {
    flagEl.style.display = 'none';
  }
}

// ── Info drawer ───────────────────────────────────────────────────────────────
function initTooltips() {
  let backdrop = document.querySelector('.drawer-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);
  }

  document.querySelectorAll('.metric-tooltip').forEach(t => {
    if (t.parentElement !== document.body) document.body.appendChild(t);
    t.setAttribute('role', 'dialog');
    t.setAttribute('aria-modal', 'false');
    const title = t.querySelector('.tooltip-title');
    if (title && !title.id) title.id = t.id + '-title';
    if (title) t.setAttribute('aria-labelledby', title.id);
  });

  let lastInvoker = null;
  function closeAll() {
    document.querySelectorAll('.metric-tooltip.open').forEach(t => t.classList.remove('open'));
    backdrop.classList.remove('open');
    document.body.classList.remove('drawer-open');
    if (lastInvoker && document.contains(lastInvoker)) lastInvoker.focus();
    lastInvoker = null;
  }
  function openDrawer(id, invoker) {
    const t = document.getElementById(id);
    if (!t) return;
    closeAll();
    t.classList.add('open');
    backdrop.classList.add('open');
    document.body.classList.add('drawer-open');
    lastInvoker = invoker || null;
    const close = t.querySelector('.tooltip-close');
    close?.focus();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-btn');
    if (btn) {
      const id = btn.dataset.tooltip;
      const t = document.getElementById(id);
      if (t?.classList.contains('open')) closeAll();
      else openDrawer(id, btn);
      return;
    }
    const close = e.target.closest('.tooltip-close');
    if (close) { closeAll(); return; }
  });

  backdrop.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
}

// ── Country search / dropdown ─────────────────────────────────────────────────
let currentISO = null, currentName = null;

function buildDropdown(filter = '') {
  const dropdown = document.getElementById('country-dropdown');
  if (!dropdown) return;
  const countries = Cache.countries?.countries || [];
  const q = filter.toLowerCase().trim();

  let items = countries;
  if (q) {
    const startsWith = countries.filter(c => c.name.toLowerCase().startsWith(q));
    const contains   = countries.filter(c => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q));
    items = [...startsWith, ...contains];
  }
  items = items.slice(0, 60);

  dropdown.innerHTML = items.map(c =>
    `<div class="dropdown-item" data-iso3="${c.iso3}" data-name="${c.name}">
      <span>${c.name}</span>
      <span class="item-tag">${c.iso3}</span>
    </div>`
  ).join('');

  dropdown.querySelectorAll('.dropdown-item').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (typeof loadCountry === 'function') loadCountry(el.dataset.iso3, el.dataset.name);
      setCountryInURL(el.dataset.iso3);
      dropdown.classList.remove('open');
    });
  });
}

function initSelector() {
  const input    = document.getElementById('country-input');
  const dropdown = document.getElementById('country-dropdown');
  if (!input || !dropdown) return;

  input.addEventListener('focus', () => {
    buildDropdown(input.value);
    dropdown.classList.add('open');
  });
  input.addEventListener('input', () => {
    buildDropdown(input.value);
    dropdown.classList.add('open');
  });
  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.remove('open'), 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('.dropdown-item');
      if (first) {
        if (typeof loadCountry === 'function') loadCountry(first.dataset.iso3, first.dataset.name);
        setCountryInURL(first.dataset.iso3);
        dropdown.classList.remove('open');
      }
      e.preventDefault();
    }
  });
}

// ── URL param helpers ─────────────────────────────────────────────────────────
function propagateCountryParam(iso3) {
  if (!iso3) return;
  const sel = 'a.left-nav-item[href*=".html"], a.left-nav-link[href*=".html"]';
  document.querySelectorAll(sel).forEach(a => {
    const base = a.getAttribute('href').split('?')[0].split('#')[0];
    a.setAttribute('href', `${base}?country=${iso3}`);
  });
}

function getCountryFromURL() {
  return new URLSearchParams(location.search).get('country') || 'DNK';
}

function setCountryInURL(iso3) {
  const url = new URL(location.href);
  url.searchParams.set('country', iso3);
  history.replaceState({}, '', url.toString());
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('bgdp-theme', next); } catch (e) {}
    if (window.__chartInstances) {
      window.__chartInstances.forEach(c => c && c.resize());
    }
    if (currentISO && typeof loadCountry === 'function') loadCountry(currentISO, currentName);
  });
}

// ── Keyboard shortcut: "/" focuses country search ─────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target;
      const isInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!isInput) {
        e.preventDefault();
        document.getElementById('country-input')?.focus();
      }
    }
  });
}

// =============================================================================
// ── FOUNDATIONAL COMPONENT RENDER FUNCTIONS ──────────────────────────────────
// HLEG Tier I: #1 IPV, #2 GHG total, #3 BII
// =============================================================================

function renderIpv(ipvEntry) {
  const el = document.getElementById('gauge-ipv');
  if (!el) return;
  if (!ipvEntry || ipvEntry.value == null) {
    showNoData(el, window.chartIpv);
    setStatus('ipv-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = ipvEntry.value;
  const maxScale = 50;
  const zones = makeZones(0, maxScale, [
    { maxVal: 10, color: '#22c55e' },
    { maxVal: 20, color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 10 ? 'green' : val <= 20 ? 'amber' : 'red';
  setStatus('ipv-status', level, level === 'green' ? null : 'Above Target');
  const vsText  = val <= 10 ? 'below danger threshold' : `${fmt(val / 20 * 100, 0)}% of danger threshold`;
  const vsColor = val <= 10 ? '#22c55e' : val <= 20 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: '% women experienced IPV', formatFn: v => fmt(v, 1) + '%', vsText, vsColor, dangerMarkLine: 20,
  });
  window.chartIpv.setOption(option, true);
  if (ipvEntry.year) {
    const footer = document.querySelector('[data-card="ipv"] .limit-label span');
    if (footer) footer.textContent = `Danger: 20% (SDG 5.2.1; lower is better; ${ipvEntry.year})`;
  }
}

function renderGhgTotal(ghgEntry) {
  const el = document.getElementById('gauge-ghg');
  if (!el) return;
  if (!ghgEntry || ghgEntry.value == null) {
    showNoData(el, window.chartGhg);
    setStatus('ghg-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = ghgEntry.value;
  const maxScale = 2000;
  const zones = makeZones(0, maxScale, [
    { maxVal: 100,      color: '#22c55e' },
    { maxVal: 500,      color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 100 ? 'green' : val <= 500 ? 'amber' : 'red';
  setStatus('ghg-status', level);
  const vsText  = val <= 100 ? 'low total' : val <= 500 ? 'medium total' : 'high total';
  const vsColor = val <= 100 ? '#22c55e' : val <= 500 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: 'MtCO₂e total (all gases)',
    formatFn: () => val >= 1000 ? `${(val / 1000).toFixed(1)}k Mt` : `${Math.round(val)} Mt`,
    vsText, vsColor, overflow: val > maxScale,
  });
  window.chartGhg.setOption(option, true);
}

function renderBii(biiEntry) {
  const el = document.getElementById('gauge-bii');
  if (!el) return;
  if (!biiEntry || biiEntry.value == null) {
    showNoData(el, window.chartBii);
    setStatus('bii-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = biiEntry.value;
  const zones = makeZones(0, 100, [
    { maxVal: 70, color: '#ef4444' }, { maxVal: 85, color: '#f59e0b' },
    { maxVal: 95, color: '#86efac' }, { maxVal: 100, color: '#22c55e' },
  ]);
  const level = val >= 85 ? 'green' : val >= 70 ? 'amber' : 'red';
  setStatus('bii-status', level, level === 'green' ? null : 'Below Target');
  const vsText  = val >= 85 ? 'above target' : `${fmt(val / 85 * 100, 0)}% of 85% target`;
  const vsColor = val >= 85 ? '#22c55e' : val >= 70 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: val, min: 0, max: 100, zones,
    unitLabel: 'BII score', formatFn: v => fmt(v, 1), vsText, vsColor });
  window.chartBii.setOption(option, true);
}

function updateFoundationalTooltips(iso3, name) {
  const ipv = Cache.ipv?.data?.[iso3];
  const ghg = Cache.ghg_total?.data?.[iso3];
  const bii = Cache.bii?.data?.[iso3];

  const ipvEl = document.getElementById('tooltip-ipv-body');
  if (ipvEl) {
    if (ipv?.value != null) {
      const v = ipv.value;
      const yr = ipv.year ? `; data year: ${ipv.year}` : '';
      ipvEl.innerHTML = `<strong>${fmt(v, 1)}%</strong> of ever-partnered women in <strong>${name}</strong> have experienced physical or sexual violence by an intimate partner in the past 12 months (SDG 5.2.1, HLEG Tier I #1)${yr}. Safe threshold: below 10%; danger: above 20%. Source: WHO GHO.`;
    } else { ipvEl.textContent = 'No IPV data available.'; }
  }

  const ghgEl = document.getElementById('tooltip-ghg-body');
  if (ghgEl) {
    if (ghg?.value != null) {
      const v = ghg.value;
      ghgEl.innerHTML = `<strong>${name}</strong> emits <strong>${v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v)} MtCO₂e</strong> total (all gases incl. LULUCF, HLEG Tier I #2). This is the most comprehensive greenhouse gas measure — including methane, N₂O, and fluorinated gases alongside CO₂. Threshold: below 100 MtCO₂e = low; 100–500 = medium; above 500 = high${ghg.year ? `; data year: ${ghg.year}` : ''}. Source: Climate Watch / UNFCCC.`;
    } else { ghgEl.textContent = 'No total GHG data available for this country.'; }
  }

  const biiEl = document.getElementById('tooltip-bii-body');
  if (biiEl) {
    if (bii?.value != null) {
      const v = bii.value;
      const yearStr = bii.year ? `; data year: ${bii.year}` : '';
      const base = `<strong>${name}'s</strong> Biodiversity Intactness Index (BII) is <strong>${fmt(v, 1)}</strong> — meaning roughly ${fmt(v, 0)}% of the wildlife and species that would naturally exist here are still present (HLEG Tier I #3)${yearStr}. Source: UK Natural History Museum, Newbold et al. (2016).`;
      let context;
      if (v >= 90)      context = `${name} is above the 90 planetary boundary — the minimum safe threshold for long-term ecosystem stability.`;
      else if (v >= 85) context = `${name} has crossed the 90 planetary boundary, though it remains above the 85 caution threshold.`;
      else if (v >= 70) context = `${name} is in the caution zone (70–85): biodiversity loss approaches hard-to-reverse ecosystem breakdown.`;
      else              context = `${name} has fallen below 70 — ecosystems risk breaking down in ways that are difficult or impossible to reverse.`;
      biiEl.innerHTML = `${base}<br><br>${context}`;
    } else { biiEl.textContent = 'No data available.'; }
  }
}

// =============================================================================
// ── CURRENT WELL-BEING COMPONENT RENDER FUNCTIONS ────────────────────────────
// HLEG Tier I: #4 hhinc, #5 lu4, #6 hale, #7 lbw, #8 learning,
//              #9 homicide, #10 lifesat, #11 loneliness (no data), #12 pm25, #13 water
// =============================================================================

function renderHouseholdIncome(hhEntry) {
  const el = document.getElementById('gauge-hhinc');
  if (!el) return;
  if (!hhEntry || hhEntry.value == null) {
    showNoData(el, window.chartHhinc);
    setStatus('hhinc-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = hhEntry.value;
  const maxScale = 100000;
  const zones = makeZones(0, maxScale, [
    { maxVal: 5000,     color: '#ef4444' },
    { maxVal: 20000,    color: '#f59e0b' },
    { maxVal: 50000,    color: '#86efac' },
    { maxVal: maxScale, color: '#22c55e' },
  ]);
  const level = val >= 20000 ? 'green' : val >= 5000 ? 'amber' : 'red';
  setStatus('hhinc-status', level, level === 'green' ? null : 'Below Target');
  const vsText  = val >= 20000 ? 'above $20k' : val >= 5000 ? `${fmt(val / 20000 * 100, 0)}% of target` : 'below $5k';
  const vsColor = val >= 20000 ? '#22c55e' : val >= 5000 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: 'income / person (USD, GDP proxy)',
    formatFn: () => fmtGni(val), vsText, vsColor,
  });
  window.chartHhinc.setOption(option, true);
}

function renderLu4(lu4Entry) {
  const el = document.getElementById('gauge-lu4');
  if (!el) return;
  if (!lu4Entry || lu4Entry.value == null) {
    showNoData(el, window.chartLu4);
    setStatus('lu4-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = lu4Entry.value;
  const maxScale = 60;
  const zones = makeZones(0, maxScale, [
    { maxVal: 5, color: '#22c55e' }, { maxVal: 10, color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 5 ? 'green' : val <= 10 ? 'amber' : 'red';
  setStatus('lu4-status', level, level === 'green' ? null : 'Above Target');
  const vsText  = val <= 5 ? 'safe zone' : `${fmt(val / 10 * 100, 0)}% of danger threshold`;
  const vsColor = val <= 5 ? '#22c55e' : val <= 10 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: '% labour underutilized', formatFn: v => fmt(v, 1) + '%', vsText, vsColor, dangerMarkLine: 10 });
  window.chartLu4.setOption(option, true);
  if (lu4Entry.year) {
    const footer = document.querySelector('[data-card="lu4"] .limit-label span');
    if (footer) footer.textContent = `Danger: 10% (lower is better; ${lu4Entry.year})`;
  }
}

function renderHale(haleEntry) {
  const el = document.getElementById('gauge-hale');
  if (!el) return;
  if (!haleEntry || haleEntry.value == null) {
    showNoData(el, window.chartHale);
    setStatus('hale-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = haleEntry.value;
  const minScale = 40; const maxScale = 80;
  const zones = makeZones(minScale, maxScale, [
    { maxVal: 60, color: '#ef4444' }, { maxVal: 70, color: '#f59e0b' },
    { maxVal: 75, color: '#86efac' }, { maxVal: maxScale, color: '#22c55e' },
  ]);
  const level = val >= 70 ? 'green' : val >= 60 ? 'amber' : 'red';
  setStatus('hale-status', level, level === 'green' ? null : 'Below Target');
  const vsText  = val >= 70 ? 'above target' : `${fmt(val / 70 * 100, 0)}% of 70-yr target`;
  const vsColor = val >= 70 ? '#22c55e' : val >= 60 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(Math.max(val, minScale), maxScale), min: minScale, max: maxScale, zones,
    unitLabel: 'healthy life years', formatFn: v => fmt(v, 1) + ' yrs', vsText, vsColor });
  window.chartHale.setOption(option, true);
}

function renderLbw(lbwEntry) {
  const el = document.getElementById('gauge-lbw');
  if (!el) return;
  if (!lbwEntry || lbwEntry.value == null) {
    showNoData(el, window.chartLbw);
    setStatus('lbw-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = lbwEntry.value;
  const maxScale = 30;
  const zones = makeZones(0, maxScale, [
    { maxVal: 7,        color: '#22c55e' },
    { maxVal: 15,       color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 7 ? 'green' : val <= 15 ? 'amber' : 'red';
  setStatus('lbw-status', level, level === 'green' ? null : 'Above Target');
  const vsText  = val <= 7 ? 'safe zone' : `${fmt(val / 15 * 100, 0)}% of danger threshold`;
  const vsColor = val <= 7 ? '#22c55e' : val <= 15 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: '% low-birthweight births', formatFn: v => fmt(v, 1) + '%', vsText, vsColor, dangerMarkLine: 15 });
  window.chartLbw.setOption(option, true);
}

function renderLearningOutcomes(loEntry) {
  const el = document.getElementById('gauge-learning');
  if (!el) return;
  if (!loEntry || loEntry.value == null) {
    showNoData(el, window.chartLearning);
    setStatus('learning-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = loEntry.value;
  const minScale = 300, maxScale = 625;
  const zones = makeZones(minScale, maxScale, [
    { maxVal: 420, color: '#ef4444' }, { maxVal: 490, color: '#f59e0b' },
    { maxVal: 550, color: '#86efac' }, { maxVal: maxScale, color: '#22c55e' },
  ]);
  const level = val >= 490 ? 'green' : val >= 420 ? 'amber' : 'red';
  setStatus('learning-status', level, level === 'green' ? null : 'Below Target');
  const vsText  = val >= 490 ? 'above OECD benchmark' : val >= 420 ? `${fmt(val / 490 * 100, 0)}% of benchmark` : 'below minimum proficiency';
  const vsColor = val >= 490 ? '#22c55e' : val >= 420 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.max(minScale, Math.min(val, maxScale)), min: minScale, max: maxScale, zones,
    unitLabel: 'harmonized test score', formatFn: v => fmt(v, 0), vsText, vsColor, dangerMarkLine: 420,
  });
  window.chartLearning.setOption(option, true);
}

function renderHomicide(hmEntry) {
  const el = document.getElementById('gauge-homicide');
  if (!el) return;
  if (!hmEntry || hmEntry.value == null) {
    showNoData(el, window.chartHomicide);
    setStatus('homicide-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = hmEntry.value;
  const maxScale = 30;
  const zones = makeZones(0, maxScale, [
    { maxVal: 3,        color: '#22c55e' },
    { maxVal: 10,       color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 3 ? 'green' : val <= 10 ? 'amber' : 'red';
  setStatus('homicide-status', level);
  const vsText  = val <= 3 ? 'low rate' : val <= 10 ? 'elevated rate' : 'high rate';
  const vsColor = val <= 3 ? '#22c55e' : val <= 10 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: 'homicides per 100k', formatFn: v => fmt(v, 1),
    vsText, vsColor, overflow: val > maxScale, dangerMarkLine: 10,
  });
  window.chartHomicide.setOption(option, true);
}

function renderLifeSatisfaction(lsEntry) {
  const el = document.getElementById('gauge-lifesat');
  if (!el) return;
  if (!lsEntry || lsEntry.value == null) {
    showNoData(el, window.chartLifesat);
    setStatus('lifesat-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = lsEntry.value;
  const zones = makeZones(0, 10, [
    { maxVal: 5,    color: '#ef4444' },
    { maxVal: 6.5,  color: '#f59e0b' },
    { maxVal: 8,    color: '#86efac' },
    { maxVal: 10,   color: '#22c55e' },
  ]);
  const level = val >= 6.5 ? 'green' : val >= 5 ? 'amber' : 'red';
  setStatus('lifesat-status', level);
  const vsText  = val >= 6.5 ? 'above benchmark' : val >= 5 ? `${fmt(val / 6.5 * 100, 0)}% of target` : 'below threshold';
  const vsColor = val >= 6.5 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: val, min: 0, max: 10, zones,
    unitLabel: 'Cantril ladder (0–10)', formatFn: v => fmt(v, 2), vsText, vsColor });
  window.chartLifesat.setOption(option, true);
}

function renderPm25(pm25Entry) {
  const el = document.getElementById('gauge-pm25');
  if (!el) return;
  if (!pm25Entry || pm25Entry.value == null) {
    showNoData(el, window.chartPm25);
    setStatus('pm25-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = pm25Entry.value;
  const maxScale = 80;
  const zones = makeZones(0, maxScale, [
    { maxVal: 5,        color: '#22c55e' },
    { maxVal: 15,       color: '#86efac' },
    { maxVal: 35,       color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 5 ? 'green' : val <= 15 ? 'green' : val <= 35 ? 'amber' : 'red';
  setStatus('pm25-status', level, level === 'green' ? null : 'Above Target');
  const vsText  = val <= 5 ? 'meets WHO guideline' : val <= 15 ? 'above WHO, below IT-3' : val <= 35 ? 'caution zone' : 'high pollution';
  const vsColor = val <= 5 ? '#22c55e' : val <= 15 ? '#86efac' : val <= 35 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: 'μg/m³ annual mean PM2.5', formatFn: v => fmt(v, 1) + ' µg',
    vsText, vsColor, overflow: val > maxScale, dangerMarkLine: 15,
  });
  window.chartPm25.setOption(option, true);
}

function renderDrinkingWater(dwEntry) {
  const el = document.getElementById('gauge-water');
  if (!el) return;
  if (!dwEntry || dwEntry.value == null) {
    showNoData(el, window.chartWater);
    setStatus('water-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = dwEntry.value;
  const zones = makeZones(0, 100, [
    { maxVal: 60,  color: '#ef4444' }, { maxVal: 85,  color: '#f59e0b' },
    { maxVal: 95,  color: '#86efac' }, { maxVal: 100, color: '#22c55e' },
  ]);
  const level = val >= 85 ? 'green' : val >= 60 ? 'amber' : 'red';
  setStatus('water-status', level, level === 'green' ? null : 'Below Target');
  const vsText  = val >= 85 ? 'above target' : val >= 60 ? `${fmt(val / 85 * 100, 0)}% of target` : 'low coverage';
  const vsColor = val >= 85 ? '#22c55e' : val >= 60 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: val, min: 0, max: 100, zones,
    unitLabel: '% safely managed drinking water', formatFn: v => fmt(v, 1) + '%', vsText, vsColor });
  window.chartWater.setOption(option, true);
}

function updateWellbeingTooltips(iso3, name) {
  const hh  = Cache.household_income?.data?.[iso3];
  const lu4 = Cache.lu4?.data?.[iso3];
  const hal = Cache.hale?.data?.[iso3];
  const lbw = Cache.lbw?.data?.[iso3];
  const lo  = Cache.learning_outcomes?.data?.[iso3];
  const hm  = Cache.homicide_rate?.data?.[iso3];
  const ls  = Cache.life_satisfaction?.data?.[iso3];
  const pm  = Cache.pm25?.data?.[iso3];
  const dw  = Cache.drinking_water?.data?.[iso3];

  const hhEl = document.getElementById('tooltip-hhinc-body');
  if (hhEl) {
    if (hh?.value != null) {
      const v = hh.value; const yr = hh.year ? `; data year: ${hh.year}` : '';
      hhEl.innerHTML = `<strong>${name}'s</strong> proxy for household disposable income per capita is <strong>${fmtGni(v)}</strong> (UNSD GDP/capita stand-in for HLEG Tier I #4)${yr}. True household sector disposable income is not exposed via the open AMA API; GDP/capita is used as a directional proxy. Threshold: below $5k/person = low; above $20k = adequate. Source: UN Statistics Division.`;
    } else { hhEl.textContent = 'No household income data available.'; }
  }

  const lu4El = document.getElementById('tooltip-lu4-body');
  if (lu4El) {
    if (lu4?.value != null) {
      const v = lu4.value;
      lu4El.innerHTML = `<strong>${name}</strong> has <strong>${fmt(v, 1)}%</strong> of its workforce unemployed, underemployed, or discouraged — the ILO composite LU4 measure (HLEG Tier I #5). Broader than headline unemployment; captures workers who want more hours and those who stopped looking. Danger threshold: 10%${lu4.year ? `; data year: ${lu4.year}` : ''}. Source: ILOSTAT.`;
    } else { lu4El.textContent = 'No data available.'; }
  }

  const haleEl = document.getElementById('tooltip-hale-body');
  if (haleEl) {
    if (hal?.value != null) {
      const v = hal.value;
      haleEl.innerHTML = `<strong>${name}'s</strong> healthy life expectancy at birth is <strong>${fmt(v, 1)} years</strong> (HLEG Tier I #6)${hal.year ? ` (${hal.year})` : ''}. HALE measures years a newborn can expect to live in full health, accounting for disability and disease. Target: 70 years; below 60 indicates serious gaps. Source: WHO GHO.`;
    } else { haleEl.textContent = 'No HALE data available.'; }
  }

  const lbwEl = document.getElementById('tooltip-lbw-body');
  if (lbwEl) {
    if (lbw?.value != null) {
      const v = lbw.value; const yr = lbw.year ? `; data year: ${lbw.year}` : '';
      lbwEl.innerHTML = `<strong>${fmt(v, 1)}%</strong> of <strong>${name}'s</strong> live births are low-birthweight (under 2,500 g, HLEG Tier I #7)${yr}. Low birthweight is a leading predictor of neonatal mortality, stunting, and lifelong cognitive deficits. Danger threshold: 15%; safe: at or below 7%. Source: WHO GHO / UNICEF.`;
    } else { lbwEl.textContent = 'No low-birthweight data available.'; }
  }

  const loEl = document.getElementById('tooltip-learning-body');
  if (loEl) {
    if (lo?.value != null) {
      const v = lo.value; const yr = lo.year ? `; data year: ${lo.year}` : '';
      let context;
      if (v >= 490)      context = `${name} is above the OECD lower benchmark (490). Pupils on average meet minimum proficiency in reading and mathematics.`;
      else if (v >= 420) context = `${name} is in the caution zone (420–490): substantial share of pupils below minimum proficiency.`;
      else               context = `${name} is below 420 — most pupils have not reached minimum proficiency in foundational reading and maths.`;
      loEl.innerHTML = `<strong>${name}'s</strong> harmonized learning score is <strong>${fmt(v, 0)}</strong> on the 300–625 World Bank HCI scale (HLEG Tier I #8, proxy for SDG 4.1.1)${yr}. Synthesises PISA, TIMSS, PIRLS, and national assessments.<br><br>${context}`;
    } else { loEl.textContent = 'No learning outcomes data available for this country.'; }
  }

  const hmEl = document.getElementById('tooltip-homicide-body');
  if (hmEl) {
    if (hm?.value != null) {
      const v = hm.value; const yr = hm.year ? `; data year: ${hm.year}` : '';
      hmEl.innerHTML = `<strong>${name}'s</strong> intentional homicide rate is <strong>${fmt(v, 1)} per 100,000</strong> population (SDG 16.1.1, HLEG Tier I #9)${yr}. Physical security and rule-of-law indicator. Threshold: ≤3 = safe; 3–10 = elevated; above 10 = high. Source: WHO GHO.`;
    } else { hmEl.textContent = 'No homicide rate data available.'; }
  }

  const lsEl = document.getElementById('tooltip-lifesat-body');
  if (lsEl) {
    if (ls?.value != null) {
      const v = ls.value; const yr = ls.year ? `; data year: ${ls.year}` : '';
      lsEl.innerHTML = `<strong>${name}'s</strong> mean life satisfaction is <strong>${fmt(v, 2)}</strong> on the 0–10 Cantril ladder (HLEG Tier I #10)${yr}. Respondents rate their current life where 0 = worst possible and 10 = best possible. Threshold: ≥6.5 = adequate; below 5.0 indicates widespread dissatisfaction. Source: World Happiness Report 2025.`;
    } else { lsEl.textContent = 'No life satisfaction data available.'; }
  }

  const pmEl = document.getElementById('tooltip-pm25-body');
  if (pmEl) {
    if (pm?.value != null) {
      const v = pm.value; const ratio = (v / 5).toFixed(1);
      if (v <= 5) {
        pmEl.innerHTML = `<strong>${name}</strong> has a mean PM2.5 of <strong>${fmt(v, 1)} µg/m³</strong> — meeting the WHO 2021 Air Quality Guideline (HLEG Tier I #12). Among the cleanest air globally.`;
      } else {
        pmEl.innerHTML = `<strong>${name}</strong> has a mean PM2.5 of <strong>${fmt(v, 1)} µg/m³</strong> — <strong>${ratio}× the WHO 2021 guideline</strong> of 5 µg/m³ (HLEG Tier I #12). PM2.5 is a major driver of cardiovascular and respiratory disease${pm.year ? `; data year: ${pm.year}` : ''}.`;
      }
    } else { pmEl.textContent = 'No PM2.5 data available for this country.'; }
  }

  const dwEl = document.getElementById('tooltip-water-body');
  if (dwEl) {
    if (dw?.value != null) {
      const v = dw.value; const yr = dw.year ? `; data year: ${dw.year}` : '';
      let context;
      if (v >= 95)      context = `Universal safely managed drinking water is essentially achieved.`;
      else if (v >= 85) context = `Most of the population has safely managed services; remaining gaps tend to concentrate in rural or marginalised areas.`;
      else if (v >= 60) context = `Substantial coverage gap — a significant minority lack safely managed services.`;
      else              context = `Low coverage — the majority of the population lacks safely managed drinking water.`;
      dwEl.innerHTML = `<strong>${fmt(v, 1)}%</strong> of <strong>${name}'s</strong> population uses safely managed drinking water services (SDG 6.1.1, HLEG Tier I #13)${yr}.<br><br>${context} Source: WHO/UNICEF JMP 2025.`;
    } else { dwEl.textContent = 'No drinking water coverage data available for this country.'; }
  }
}

// =============================================================================
// ── EQUALITY & INCLUSION COMPONENT RENDER FUNCTIONS ──────────────────────────
// HLEG Tier I: #14 gini, #15 poverty_societal, #16 gender_pay_ratio
// =============================================================================

function renderGini(giniEntry) {
  const el = document.getElementById('gauge-gini');
  if (!el) return;
  if (!giniEntry || giniEntry.value == null) {
    showNoData(el, window.chartGini);
    setStatus('gini-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = giniEntry.value;
  const maxScale = 70;
  const zones = makeZones(0, maxScale, [
    { maxVal: 35,       color: '#22c55e' },
    { maxVal: 45,       color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val < 35 ? 'green' : val < 45 ? 'amber' : 'red';
  setStatus('gini-status', level);
  const vsText  = val < 35 ? 'low inequality' : val < 45 ? 'moderate inequality' : 'high inequality';
  const vsColor = val < 35 ? '#22c55e' : val < 45 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: 'Gini index (0=equal, 100=unequal)', formatFn: v => fmt(v, 1), vsText, vsColor, dangerMarkLine: 45 });
  window.chartGini.setOption(option, true);
}

function renderPovertySocietal(psEntry) {
  const el = document.getElementById('gauge-poverty-societal');
  if (!el) return;
  if (!psEntry || psEntry.value == null) {
    showNoData(el, window.chartPovertySocietal);
    setStatus('poverty-societal-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = psEntry.value;
  const maxScale = 100;
  const zones = makeZones(0, maxScale, [
    { maxVal: 10, color: '#22c55e' }, { maxVal: 20, color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 10 ? 'green' : val <= 20 ? 'amber' : 'red';
  setStatus('poverty-societal-status', level, level === 'green' ? null : 'Above Target');
  const vsText  = val <= 10 ? 'below 10% target' : `${fmt(val / 20 * 100, 0)}% of danger threshold`;
  const vsColor = val <= 10 ? '#22c55e' : val <= 20 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: '% below $6.85/day (societal)', formatFn: v => fmt(v, 1) + '%', vsText, vsColor, dangerMarkLine: 20 });
  window.chartPovertySocietal.setOption(option, true);
}

function renderGenderPayRatio(gprEntry) {
  const el = document.getElementById('gauge-gpr');
  if (!el) return;
  if (!gprEntry || gprEntry.value == null) {
    showNoData(el, window.chartGpr);
    setStatus('gpr-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = gprEntry.value;
  const minScale = 0.50, maxScale = 1.30;
  const zones = makeZones(minScale, maxScale, [
    { maxVal: 0.80,  color: '#ef4444' }, { maxVal: 0.92,  color: '#f59e0b' },
    { maxVal: 1.05,  color: '#22c55e' }, { maxVal: maxScale, color: '#86efac' },
  ]);
  const level = val >= 0.92 ? 'green' : val >= 0.80 ? 'amber' : 'red';
  setStatus('gpr-status', level);
  const vsText  = val >= 0.92 ? 'near parity' : `${((1 - val) * 100).toFixed(1)}% pay gap`;
  const vsColor = val >= 0.92 ? '#22c55e' : val >= 0.80 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(Math.max(val, minScale), maxScale), min: minScale, max: maxScale, zones,
    unitLabel: 'female / male hourly earnings', formatFn: v => v.toFixed(2), vsText, vsColor,
  });
  window.chartGpr.setOption(option, true);
  if (gprEntry.year) {
    const footer = document.querySelector('[data-card="gpr"] .limit-label span');
    if (footer) footer.textContent = `Parity: 1.00 (ILO SDG 8.5.1; ${gprEntry.year})`;
  }
}

function updateEqualityTooltips(iso3, name) {
  const gini = Cache.gini?.data?.[iso3];
  const ps   = Cache.poverty_societal?.data?.[iso3];
  const gpr  = Cache.gender_pay_ratio?.data?.[iso3];

  const giniEl = document.getElementById('tooltip-gini-body');
  if (giniEl) {
    if (gini?.value != null) {
      const v = gini.value; const yr = gini.year ? `; data year: ${gini.year}` : '';
      giniEl.innerHTML = `<strong>${name}'s</strong> Gini index is <strong>${fmt(v, 1)}</strong> on a 0 (perfect equality) – 100 (perfect inequality) scale (HLEG Tier I #14)${yr}. Below 35 = low inequality; 35–45 = moderate; 45+ = high. Source: World Bank (SI.POV.GINI).`;
    } else { giniEl.textContent = 'No Gini data available.'; }
  }

  const psEl = document.getElementById('tooltip-poverty-societal-body');
  if (psEl) {
    if (ps?.value != null) {
      const v = ps.value; const yr = ps.year ? `; data year: ${ps.year}` : '';
      psEl.innerHTML = `<strong>${fmt(v, 1)}%</strong> of <strong>${name}'s</strong> population lives below the World Bank societal poverty line ($6.85/day PPP, HLEG Tier I #15)${yr}. A single cross-country comparable line — stays fixed across income groups for meaningful direct comparisons. Danger threshold: 20%; safe below 10%. Source: World Bank (SI.POV.SOPO).`;
    } else { psEl.textContent = 'No societal poverty data available for this country.'; }
  }

  const gprEl = document.getElementById('tooltip-gpr-body');
  if (gprEl) {
    if (gpr?.value != null) {
      const v = gpr.value; const yr = gpr.year ? `; data year: ${gpr.year}` : '';
      const gap = v < 1 ? `Women earn ${((1 - v) * 100).toFixed(1)}% less per hour than men.` : `Women earn ${((v - 1) * 100).toFixed(1)}% more per hour than men.`;
      gprEl.innerHTML = `<strong>${name}'s</strong> gender pay ratio is <strong>${v.toFixed(2)}</strong> (female / male hourly earnings, SDG 8.5.1, HLEG Tier I #16)${yr}. ${gap} Threshold: ≥0.92 = near-parity; <0.80 = significant gap. Source: ILOSTAT.`;
    } else { gprEl.textContent = 'No gender pay data available.'; }
  }
}

// =============================================================================
// ── SUSTAINABILITY & RESILIENCE COMPONENT RENDER FUNCTIONS ───────────────────
// HLEG Tier I: #17 produced_capital, #18 neet, #19 govconf, #20 trust
// =============================================================================

function renderProducedCapital(capEntry) {
  const el = document.getElementById('gauge-capital');
  if (!el) return;
  if (!capEntry || capEntry.value == null) {
    showNoData(el, window.chartCapital);
    setStatus('capital-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = capEntry.value;
  const maxScale = 200000;
  const zones = makeZones(0, maxScale, [
    { maxVal: 10000,    color: '#ef4444' }, { maxVal: 50000,    color: '#f59e0b' },
    { maxVal: 120000,   color: '#86efac' }, { maxVal: maxScale, color: '#22c55e' },
  ]);
  const level = val >= 50000 ? 'green' : val >= 10000 ? 'amber' : 'red';
  setStatus('capital-status', level, level === 'green' ? null : 'Below Target');
  const vsText  = val >= 50000 ? 'above threshold' : val >= 10000 ? `${fmt(val / 50000 * 100, 0)}% of target` : 'low capital base';
  const vsColor = val >= 50000 ? '#22c55e' : val >= 10000 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({
    value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: 'net produced capital / person (USD)', formatFn: () => fmtGni(val), vsText, vsColor,
  });
  window.chartCapital.setOption(option, true);
}

function renderNeet(neetEntry) {
  const el = document.getElementById('gauge-neet');
  if (!el) return;
  if (!neetEntry || neetEntry.value == null) {
    showNoData(el, window.chartNeet);
    setStatus('neet-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = neetEntry.value;
  const maxScale = 60;
  const zones = makeZones(0, maxScale, [
    { maxVal: 10, color: '#22c55e' }, { maxVal: 15, color: '#f59e0b' },
    { maxVal: maxScale, color: '#ef4444' },
  ]);
  const level = val <= 10 ? 'green' : val <= 15 ? 'amber' : 'red';
  setStatus('neet-status', level, level === 'green' ? null : 'Above Target');
  const vsText  = val <= 10 ? 'safe zone' : `${fmt(val / 15 * 100, 0)}% of danger threshold`;
  const vsColor = val <= 10 ? '#22c55e' : val <= 15 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: Math.min(val, maxScale), min: 0, max: maxScale, zones,
    unitLabel: '% youth NEET (15–24)', formatFn: v => fmt(v, 1) + '%', vsText, vsColor, dangerMarkLine: 15 });
  window.chartNeet.setOption(option, true);
}

function renderWvsGovConfidence(gcEntry) {
  const el = document.getElementById('gauge-govconf');
  if (!el) return;
  if (!gcEntry || gcEntry.value == null) {
    showNoData(el, window.chartGovconf);
    setStatus('govconf-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = gcEntry.value;
  const zones = makeZones(0, 100, [
    { maxVal: 30,  color: '#ef4444' }, { maxVal: 50,  color: '#f59e0b' },
    { maxVal: 75,  color: '#86efac' }, { maxVal: 100, color: '#22c55e' },
  ]);
  const level = val >= 50 ? 'green' : val >= 30 ? 'amber' : 'red';
  setStatus('govconf-status', level);
  const vsText  = val >= 50 ? 'high confidence' : val >= 30 ? 'moderate confidence' : 'low confidence';
  const vsColor = val >= 50 ? '#22c55e' : val >= 30 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: val, min: 0, max: 100, zones,
    unitLabel: '% confidence in civil services', formatFn: v => fmt(v, 1) + '%', vsText, vsColor });
  window.chartGovconf.setOption(option, true);
}

function renderWvsTrust(trustEntry) {
  const el = document.getElementById('gauge-trust');
  if (!el) return;
  if (!trustEntry || trustEntry.value == null) {
    showNoData(el, window.chartTrust);
    setStatus('trust-status', 'gray');
    return;
  }
  hideNoData(el);
  const val = trustEntry.value;
  const zones = makeZones(0, 100, [
    { maxVal: 20,  color: '#ef4444' }, { maxVal: 40,  color: '#f59e0b' },
    { maxVal: 70,  color: '#86efac' }, { maxVal: 100, color: '#22c55e' },
  ]);
  const level = val >= 40 ? 'green' : val >= 20 ? 'amber' : 'red';
  setStatus('trust-status', level);
  const vsText  = val >= 40 ? 'high trust' : val >= 20 ? 'moderate trust' : 'low trust';
  const vsColor = val >= 40 ? '#22c55e' : val >= 20 ? '#f59e0b' : '#ef4444';
  const option = buildBulletOption({ value: val, min: 0, max: 100, zones,
    unitLabel: '% "most people can be trusted"', formatFn: v => fmt(v, 1) + '%', vsText, vsColor });
  window.chartTrust.setOption(option, true);
}

function updateSustainabilityTooltips(iso3, name) {
  const cap = Cache.produced_capital?.data?.[iso3];
  const net = Cache.neet?.data?.[iso3];
  const gc  = Cache.wvs_gov_confidence?.data?.[iso3];
  const tr  = Cache.wvs_trust?.data?.[iso3];

  const capEl = document.getElementById('tooltip-capital-body');
  if (capEl) {
    if (cap?.value != null) {
      const v = cap.value; const yr = cap.year ? `; data year: ${cap.year}` : '';
      capEl.innerHTML = `<strong>${name}'s</strong> net produced capital stock is <strong>${fmtGni(v)} per person</strong> — the value of machinery, infrastructure, buildings, and other built assets (World Bank CWON 2021, HLEG Tier I #17)${yr}. Threshold: below $10k/person = low; $10–50k = developing; above $50k = adequate. Source: World Bank CWON (NW.PCA.TOTL.CD).`;
    } else { capEl.textContent = 'No produced capital data available for this country.'; }
  }

  const neetEl = document.getElementById('tooltip-neet-body');
  if (neetEl) {
    if (net?.value != null) {
      const v = net.value;
      neetEl.innerHTML = `<strong>${name}</strong> has <strong>${fmt(v, 1)}%</strong> of youth aged 15–24 not in employment, education, or training (NEET, HLEG Tier I #18). High NEET rates signal a generation at risk of skill stagnation and long-term unemployment. Danger threshold: 15%${net.year ? `; data year: ${net.year}` : ''}. Source: ILOSTAT.`;
    } else { neetEl.textContent = 'No data available.'; }
  }

  const gcEl = document.getElementById('tooltip-govconf-body');
  if (gcEl) {
    if (gc?.value != null) {
      const v = gc.value; const yr = gc.year ? `; data year: ${gc.year}` : '';
      gcEl.innerHTML = `<strong>${fmt(v, 1)}%</strong> of <strong>${name}'s</strong> adult population express confidence in the civil service (HLEG Tier I #19)${yr}. Captures perceived state capacity and impartiality. Threshold: 50%+ = high; below 30% = low. Coverage limited to ~65 countries (World Values Survey Wave 7). Source: WVS.`;
    } else { gcEl.textContent = 'No civil-service confidence data available (WVS Wave 7 covers ~65 countries).'; }
  }

  const trEl = document.getElementById('tooltip-trust-body');
  if (trEl) {
    if (tr?.value != null) {
      const v = tr.value; const yr = tr.year ? `; data year: ${tr.year}` : '';
      trEl.innerHTML = `<strong>${fmt(v, 1)}%</strong> of <strong>${name}'s</strong> adult population say "most people can be trusted" (HLEG Tier I #20)${yr}. Generalised social trust is one of the strongest correlates of governance quality and collective action. Threshold: 40%+ = high; below 20% = low. Coverage limited to ~66 countries (World Values Survey Wave 7). Source: WVS.`;
    } else { trEl.textContent = 'No social trust data available (WVS Wave 7 covers ~66 countries).'; }
  }
}
