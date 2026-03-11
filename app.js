/* =====================================================
   Oil Depletion Tracker — Application Logic
   ===================================================== */

"use strict";

// ─── State ───────────────────────────────────────────
let barChartInstance = null;
let pieChartInstance = null;
let countdownSeconds = 86400; // 24 hours
let countdownInterval = null;

// ─── Init ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  startCountdown();
  setLastRefresh();
});

function renderAll() {
  renderAlertBanner();
  renderKPIs();
  renderBarChart();
  renderCountryCards();
  renderOpportunities();
  renderStations();
  renderAllCountriesTable();
  renderDangoteProfile();
}

function manualRefresh() {
  const btn = document.getElementById("btnRefresh");
  btn.textContent = "↻ Refreshing…";
  btn.disabled = true;

  // Simulate a brief data refresh (in production this would fetch live data)
  setTimeout(() => {
    // Slightly nudge reserve days to simulate live data (+/- 1 day)
    OIL_DATA.countries.forEach(c => {
      const nudge = (Math.random() - 0.5) * 2; // -1 to +1
      c.reserveDays = Math.max(1, Math.round(c.reserveDays + nudge));
      c.currentReserves_mb = parseFloat((c.currentReserves_mb + nudge * 0.1).toFixed(2));
    });
    OIL_DATA.lastUpdated = new Date().toISOString();
    renderAll();
    setLastRefresh();
    resetCountdown();
    btn.textContent = "↻ Refresh Now";
    btn.disabled = false;
  }, 900);
}

function setLastRefresh() {
  document.getElementById("lastRefreshTime").textContent =
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Countdown Timer ──────────────────────────────────
function startCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    countdownSeconds--;
    if (countdownSeconds <= 0) {
      countdownSeconds = 86400;
      manualRefresh();
    }
    const h = Math.floor(countdownSeconds / 3600);
    const m = Math.floor((countdownSeconds % 3600) / 60);
    const s = countdownSeconds % 60;
    document.getElementById("countdownTimer").textContent =
      `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }, 1000);
}

function resetCountdown() {
  countdownSeconds = 86400;
}

// ─── Alert Banner ─────────────────────────────────────
function renderAlertBanner() {
  const critical = OIL_DATA.countries.filter(c => c.status === "CRITICAL");
  const names = critical.map(c => `${c.flag} ${c.name} (${c.reserveDays} days)`).join(" · ");
  document.getElementById("alertText").textContent =
    `CRITICAL ALERTS: ${critical.length} countries below 45-day reserve threshold — ${names}`;
}

// ─── KPI Cards ────────────────────────────────────────
function renderKPIs() {
  const countries = OIL_DATA.countries;
  const critical  = countries.filter(c => c.status === "CRITICAL").length;
  const watch     = countries.filter(c => c.status === "WATCH").length;
  const opps      = countries.filter(c => c.dangoteOpportunity).length;
  const lowestDays = Math.min(...countries.map(c => c.reserveDays));
  const lowestCountry = countries.find(c => c.reserveDays === lowestDays);
  const totalStations = getDisruptedStations().length;
  const continentCount = new Set(countries.map(c => c.continent)).size;

  const kpis = [
    { label: "Countries Tracked", value: countries.length, cls: "accent", sub: `across ${continentCount} continents`, clickable: true },
    { label: "CRITICAL Status", value: critical, cls: "critical", sub: "below 45-day threshold" },
    { label: "WATCH Status", value: watch, cls: "watch", sub: "45–89 day range" },
    { label: "Lowest Reserve", value: `${lowestDays}d`, cls: "critical", sub: `${lowestCountry.flag} ${lowestCountry.name}` },
    { label: "Dangote Targets", value: opps, cls: "accent", sub: "high-opportunity countries" },
    { label: "Disrupted Facilities", value: totalStations, cls: "watch", sub: "stations & depots" },
  ];

  document.getElementById("kpiRow").innerHTML = kpis.map(k => `
    <div class="kpi-card${k.clickable ? " kpi-clickable" : ""}" ${k.clickable ? 'onclick="openCountriesListModal()" title="Click to view all tracked countries"' : ""}>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
      ${k.clickable ? '<div class="kpi-expand-hint">↗ Click to expand</div>' : ""}
    </div>
  `).join("");
}

// ─── Bar Chart ────────────────────────────────────────
function renderBarChart() {
  // Show all countries sorted by reserve days (lowest = most critical at top)
  const sorted = [...OIL_DATA.countries].sort((a, b) => a.reserveDays - b.reserveDays);
  const labels  = sorted.map(c => `${c.flag} ${c.name}`);
  const data    = sorted.map(c => c.reserveDays);
  const colors  = sorted.map(c =>
    c.status === "CRITICAL" ? "#e74c3c" :
    c.status === "WATCH"    ? "#f39c12" : "#27ae60"
  );

  // Set canvas size dynamically: fill container width, 22px per country row
  const rowHeight = 22;
  const canvas    = document.getElementById("barChart");
  const scroll    = document.getElementById("barChartScroll");
  const w         = scroll.clientWidth || 600;
  canvas.width        = w;
  canvas.style.width  = w + "px";
  canvas.height       = sorted.length * rowHeight + 30;
  canvas.style.height = canvas.height + "px";

  const ctx = canvas.getContext("2d");
  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Reserve Days",
        data,
        backgroundColor: colors,
        borderRadius: 3,
        barThickness: 14,
      }]
    },
    options: {
      indexAxis: "y",           // Horizontal bars — names on the left
      responsive: false,         // We control size manually
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw} days of supply remaining`,
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#7d8590", font: { size: 10 } },
          grid: { color: "#21262d" },
          title: { display: true, text: "Days of Supply Remaining", color: "#7d8590" },
        },
        y: {
          ticks: {
            color: "#c9d1d9",
            font: { size: 10 },
            autoSkip: false,    // Show every label
          },
          grid: { color: "#21262d" },
        }
      },
      animation: { duration: 400 }
    }
  });
}

// ─── Pie Chart ────────────────────────────────────────
function renderPieChart() {
  const opps   = getOpportunities();
  const labels = opps.map(c => `${c.flag} ${c.name}`);
  const data   = opps.map(c => c.opportunityScore);
  const colors = ["#f6a623","#e74c3c","#f39c12","#27ae60","#58a6ff","#bc8cff","#ff7bb5"];

  const ctx = document.getElementById("pieChart").getContext("2d");
  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderColor: "#161b22",
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#7d8590", font: { size: 10 }, boxWidth: 12, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` Score: ${ctx.raw}/100`,
          }
        }
      },
      animation: { duration: 500 }
    }
  });
}

// ─── Country Cards ────────────────────────────────────
function renderCountryCards() {
  const sorted = [...OIL_DATA.countries].sort((a, b) => a.reserveDays - b.reserveDays);
  document.getElementById("countryCards").innerHTML = sorted.map(c => countryCardHTML(c)).join("");
}

function countryCardHTML(c) {
  const maxDays   = 180;
  const fillPct   = Math.min(100, (c.reserveDays / maxDays) * 100);
  const fillColor = c.status === "CRITICAL" ? "#e74c3c" : c.status === "WATCH" ? "#f39c12" : "#27ae60";
  const dangoteTag = c.dangoteOpportunity
    ? `<div class="card-dangote-tag">🎯 Dangote Target · Score ${c.opportunityScore}/100</div>`
    : "";
  return `
    <div class="country-card ${c.status}" onclick="openModal('${c.id}')">
      <div class="card-header">
        <span class="card-flag">${c.flag}</span>
        <span class="card-name">${c.name}</span>
        <span class="card-status-badge badge-${c.status}">${c.status}</span>
      </div>
      <div class="card-days ${c.status}">${c.reserveDays}</div>
      <div class="card-days-label">days of supply remaining</div>
      <div class="card-meter">
        <div class="card-meter-fill" style="width:${fillPct}%;background:${fillColor}"></div>
      </div>
      <div class="card-stat"><span>Import dependency</span><span>${c.importDependency}%</span></div>
      <div class="card-stat"><span>Daily consumption</span><span>${formatBPD(c.dailyConsumption_bpd)}</span></div>
      <div class="card-stat"><span>Trend</span><span>${trendIcon(c.trend)} ${c.trend}</span></div>
      ${dangoteTag}
    </div>`;
}

// ─── Opportunities ────────────────────────────────────
function renderOpportunities() {
  const opps = getOpportunities();
  document.getElementById("opportunitiesList").innerHTML = opps.map((c, i) => `
    <div class="opp-card">
      <div class="opp-rank">#${i + 1}</div>
      <div class="opp-body">
        <h3>${c.flag} ${c.name} <span class="card-status-badge badge-${c.status}">${c.status}</span></h3>
        <p>${c.notes}</p>
        <div class="opp-meta">
          <span class="opp-tag">⛽ ${c.reserveDays} days left</span>
          <span class="opp-tag">📦 Import dep: ${c.importDependency}%</span>
          <span class="opp-tag">🌍 ${c.continent}</span>
          <span class="opp-tag">${trendIcon(c.trend)} ${c.trend}</span>
          <span class="opp-tag">💧 ${formatBPD(c.dailyConsumption_bpd)} BPD demand</span>
        </div>
      </div>
      <div class="opp-score-col">
        <div class="opp-score-num">${c.opportunityScore}</div>
        <div class="opp-score-label">/ 100 score</div>
        <button class="opp-action-btn" onclick="openModal('${c.id}')">View Details →</button>
      </div>
    </div>
  `).join("");
}

// ─── Stations ─────────────────────────────────────────
let _allStations = [];

function renderStations() {
  _allStations = getDisruptedStations();
  renderStationRows(_allStations);
}

function renderStationRows(stations) {
  if (stations.length === 0) {
    document.getElementById("stationsList").innerHTML =
      `<p style="color:var(--text-muted);padding:1rem 0;">No stations match the current filter.</p>`;
    return;
  }
  const rows = stations.map(s => `
    <tr>
      <td><div class="station-name">${s.name}</div></td>
      <td><div class="station-city">${s.countryFlag} ${s.countryName}</div><div class="station-city">${s.city}</div></td>
      <td>${s.type}</td>
      <td><span class="status-pill ${statusPillClass(s.status)}">${s.status}</span></td>
    </tr>
  `).join("");

  document.getElementById("stationsList").innerHTML = `
    <table class="stations-table">
      <thead>
        <tr>
          <th>Facility Name</th>
          <th>Country / City</th>
          <th>Type</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.75rem;">
      Showing ${stations.length} disrupted facilities. Click any country card for full station details.
    </p>`;
}

function filterStations() {
  const q      = document.getElementById("stationSearch").value.toLowerCase();
  const status = document.getElementById("stationStatusFilter").value.toLowerCase();
  let filtered = _allStations;
  if (q) filtered = filtered.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.city.toLowerCase().includes(q) ||
    s.countryName.toLowerCase().includes(q)
  );
  if (status) filtered = filtered.filter(s => s.status.toLowerCase().includes(status));
  renderStationRows(filtered);
}

function statusPillClass(status) {
  const s = status.toLowerCase();
  if (s.includes("clos") || s.includes("shutdown")) return "pill-closed";
  if (s.includes("reduc") || s.includes("partial") || s.includes("output")) return "pill-reduced";
  if (s.includes("gap") || s.includes("dry") || s.includes("intermittent")) return "pill-gap";
  if (s.includes("pressure") || s.includes("constrain") || s.includes("stretch")) return "pill-pressure";
  if (s.includes("risk") || s.includes("financial")) return "pill-risk";
  return "pill-other";
}

// ─── All Countries Table ──────────────────────────────
let _sortCol = "reserveDays";
let _sortAsc = true;

function renderAllCountriesTable() {
  const q         = (document.getElementById("countrySearch")?.value || "").toLowerCase();
  const continent = document.getElementById("continentFilter")?.value || "";
  const status    = document.getElementById("statusFilter")?.value || "";

  let list = [...OIL_DATA.countries];
  if (q)         list = list.filter(c => c.name.toLowerCase().includes(q) || c.continent.toLowerCase().includes(q));
  if (continent) list = list.filter(c => c.continent === continent);
  if (status)    list = list.filter(c => c.status === status);

  list.sort((a, b) => {
    let av = a[_sortCol], bv = b[_sortCol];
    if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    return _sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const arrow = col => col === _sortCol ? (_sortAsc ? " ↑" : " ↓") : "";

  const rows = list.map(c => `
    <tr onclick="openModal('${c.id}')">
      <td>${c.flag} <strong>${c.name}</strong></td>
      <td>${c.continent}</td>
      <td style="font-family:monospace;font-weight:700;color:${getStatusColor(c.status)}">${c.reserveDays}</td>
      <td><span class="card-status-badge badge-${c.status}">${c.status}</span></td>
      <td>${c.importDependency}%</td>
      <td>${formatBPD(c.dailyConsumption_bpd)}</td>
      <td>${trendIcon(c.trend)} ${c.trend}</td>
      <td>${c.dangoteOpportunity ? `<span style="color:var(--dangote);font-weight:700">✓ ${c.opportunityScore}/100</span>` : "—"}</td>
    </tr>
  `).join("");

  document.getElementById("allCountriesTable").innerHTML = `
    <table class="countries-table">
      <thead>
        <tr>
          <th onclick="sortCountries('name')">Country${arrow("name")}</th>
          <th onclick="sortCountries('continent')">Region${arrow("continent")}</th>
          <th onclick="sortCountries('reserveDays')">Days Left${arrow("reserveDays")}</th>
          <th onclick="sortCountries('status')">Status${arrow("status")}</th>
          <th onclick="sortCountries('importDependency')">Import %${arrow("importDependency")}</th>
          <th onclick="sortCountries('dailyConsumption_bpd')">Consumption${arrow("dailyConsumption_bpd")}</th>
          <th onclick="sortCountries('trend')">Trend${arrow("trend")}</th>
          <th onclick="sortCountries('opportunityScore')">Dangote Score${arrow("opportunityScore")}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.75rem;">
      ${list.length} countries shown. Click any row for full details.
    </p>`;
}

function sortCountries(col) {
  if (_sortCol === col) _sortAsc = !_sortAsc;
  else { _sortCol = col; _sortAsc = true; }
  renderAllCountriesTable();
}

function filterCountries() {
  renderAllCountriesTable();
}

// ─── Dangote Profile ──────────────────────────────────
function renderDangoteProfile() {
  const d = OIL_DATA.dangote;
  const products = d.products.map(p => `<span class="product-tag">${p}</span>`).join("");

  document.getElementById("dangoteProfile").innerHTML = `
    <div class="dangote-hero">
      <div class="dangote-logo">🏭</div>
      <div>
        <h3>${d.name}</h3>
        <p>${d.location}</p>
        <p style="margin-top:0.35rem;color:#f0d090;">${d.contact_note}</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Refining Capacity</div>
        <div class="info-val">${d.capacity_bpd.toLocaleString()} BPD</div>
        <div class="info-sub">Barrels per day — largest single-train in the world</div>
      </div>
      <div class="info-card">
        <div class="info-label">Operational Status</div>
        <div class="info-val" style="color:var(--normal)">${d.status}</div>
        <div class="info-sub">Commenced production 2024</div>
      </div>
      <div class="info-card">
        <div class="info-label">Products Available</div>
        <div class="products-list">${products}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Export Potential</div>
        <div class="info-val" style="color:var(--dangote)">${getOpportunities().length} Target Markets</div>
        <div class="info-sub">Countries actively flagged for supply deals</div>
      </div>
    </div>

    <div class="broker-guide">
      <h3>💼 Your Brokerage Action Plan</h3>
      <ol class="broker-steps">
        <li>Identify the highest-scoring countries using the <strong>Deal Opportunities</strong> tab — these are the most urgent buyers.</li>
        <li>Review the <strong>Disrupted Stations</strong> tab to find on-the-ground evidence: closed refineries, dry stations, and supply-gap depots in each target country.</li>
        <li>Contact the national energy ministry or state oil company of the target country. Present the supply gap data as a business case.</li>
        <li>Reach out to Dangote Petroleum Refinery's sales & export division with the country's import volume needs and flag your role as a broker/intermediary.</li>
        <li>Structure a commodity brokerage agreement — a percentage of the FOB/CIF contract value as your commission.</li>
        <li>Repeat the process: the tracker refreshes daily so new opportunities surface automatically.</li>
      </ol>
    </div>

    <div style="margin-top:1.5rem;">
      <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em;">Top Current Dangote Targets (Live Ranking)</h3>
      ${getOpportunities().slice(0, 5).map((c, i) => `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--border);">
          <span style="font-size:1.1rem;font-family:monospace;color:var(--dangote);font-weight:800;min-width:1.5rem;">${i+1}</span>
          <span style="font-size:1.2rem;">${c.flag}</span>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:0.92rem;">${c.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${c.reserveDays} days remaining · ${c.importDependency}% import dependent</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.2rem;font-weight:800;color:var(--dangote);font-family:monospace;">${c.opportunityScore}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">/ 100</div>
          </div>
          <button class="opp-action-btn" style="width:auto;padding:0.3rem 0.7rem;" onclick="showView('opportunities')">View</button>
        </div>
      `).join("")}
    </div>
  `;
}

// ─── Countries List Modal (Countries Tracked KPI click) ───────────────────────
function openCountriesListModal() {
  const allEntries = [
    ...OIL_DATA.countries,
    ...(OIL_DATA.nonOfficialTerritories || []),
  ];
  const continents = [...new Set(allEntries.map(c => c.continent))].sort();
  const total      = allEntries.length;
  const official   = OIL_DATA.countries.length;
  const nonOff     = (OIL_DATA.nonOfficialTerritories || []).length;
  const critical   = allEntries.filter(c => c.status === "CRITICAL").length;
  const watch      = allEntries.filter(c => c.status === "WATCH").length;
  const normal     = allEntries.filter(c => c.status === "NORMAL").length;

  const continentOptions = continents.map(c =>
    `<option value="${c}">${c}</option>`
  ).join("");

  document.getElementById("modalContent").innerHTML = `
    <div style="margin-bottom:1rem;">
      <div class="modal-country-name" style="font-size:1.4rem;">🌍 All ${total} Countries & Territories Tracked</div>
      <p style="color:var(--text-muted);font-size:0.83rem;margin-top:0.3rem;">
        ${official} UN member states + <span style="color:#f39c12;">${nonOff} non-official territories</span> buying oil.
        Click any entry for full details.
      </p>
      <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:0.75rem;">
        <span style="background:#e74c3c22;color:#e74c3c;border:1px solid #e74c3c44;border-radius:12px;padding:0.2rem 0.7rem;font-size:0.75rem;font-weight:700;">🔴 ${critical} Critical</span>
        <span style="background:#f39c1222;color:#f39c12;border:1px solid #f39c1244;border-radius:12px;padding:0.2rem 0.7rem;font-size:0.75rem;font-weight:700;">🟡 ${watch} Watch</span>
        <span style="background:#27ae6022;color:#27ae60;border:1px solid #27ae6044;border-radius:12px;padding:0.2rem 0.7rem;font-size:0.75rem;font-weight:700;">🟢 ${normal} Normal</span>
      </div>
    </div>

    <div style="display:flex;gap:0.6rem;margin-bottom:0.9rem;flex-wrap:wrap;">
      <input type="text" id="clmSearch" placeholder="🔍 Search countries…"
        oninput="filterCountriesListModal()"
        style="flex:1;min-width:160px;padding:0.45rem 0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:0.82rem;">
      <select id="clmStatus" onchange="filterCountriesListModal()"
        style="padding:0.45rem 0.6rem;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:0.82rem;">
        <option value="">All Status</option>
        <option value="CRITICAL">🔴 Critical</option>
        <option value="WATCH">🟡 Watch</option>
        <option value="NORMAL">🟢 Normal</option>
      </select>
      <select id="clmContinent" onchange="filterCountriesListModal()"
        style="padding:0.45rem 0.6rem;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:0.82rem;">
        <option value="">All Continents</option>
        ${continentOptions}
      </select>
    </div>

    <div id="clmResultCount" style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;"></div>
    <div id="clmCountGrid" class="clm-grid"></div>
  `;

  filterCountriesListModal();
  document.getElementById("modalOverlay").classList.add("open");
}

function filterCountriesListModal() {
  const q         = (document.getElementById("clmSearch")?.value || "").toLowerCase();
  const status    = document.getElementById("clmStatus")?.value || "";
  const continent = document.getElementById("clmContinent")?.value || "";

  // Combine official countries + non-official territories
  const allEntries = [
    ...OIL_DATA.countries,
    ...(OIL_DATA.nonOfficialTerritories || []),
  ];
  const total = allEntries.length;

  let list = [...allEntries];
  if (q)         list = list.filter(c => c.name.toLowerCase().includes(q) || c.continent.toLowerCase().includes(q));
  if (status)    list = list.filter(c => c.status === status);
  if (continent) list = list.filter(c => c.continent === continent);
  list.sort((a, b) => a.reserveDays - b.reserveDays);

  const countEl = document.getElementById("clmResultCount");
  if (countEl) countEl.textContent = `Showing ${list.length} of ${total} countries & territories`;

  const grid = document.getElementById("clmCountGrid");
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);padding:1rem 0;grid-column:1/-1;">No countries match the filter.</p>`;
    return;
  }

  grid.innerHTML = list.map(c => `
    <div class="clm-item clm-${c.status}${c.official === false ? " clm-nonofficial" : ""}"
         onclick="openCountryFromList('${c.id}')" title="${c.name} — Click for full details">
      <div class="clm-flag">${c.flag}</div>
      <div class="clm-name">${c.name}${c.official === false ? '<span class="clm-territory-tag">Territory</span>' : ""}</div>
      <div class="clm-days" style="color:${getStatusColor(c.status)}">${c.reserveDays}d</div>
      <div class="clm-meta">
        <span class="card-status-badge badge-${c.status}" style="font-size:0.58rem;">${c.status}</span>
        <span style="font-size:0.65rem;color:var(--text-muted);">${c.continent}</span>
      </div>
    </div>
  `).join("");
}

function openCountryFromList(countryId) {
  // Close the list modal first, then open the country detail modal
  openModal(countryId);
}

// ─── Modal ────────────────────────────────────────────
function openModal(countryId) {
  // look in both official countries and non-official territories
  const c = OIL_DATA.countries.find(x => x.id === countryId)
         || (OIL_DATA.nonOfficialTerritories || []).find(x => x.id === countryId);
  if (!c) return;

  // Supplemental detail (buyers, new stations, producer info)
  const detail = COUNTRY_DETAILS[countryId] || {};
  const isProducer = detail.isOilProducer ?? c.isOilProducer ?? OIL_PRODUCERS.has(countryId);
  const productionNote = detail.productionNote || c.productionNote
    || (isProducer ? "Oil-producing nation." : "No domestic oil production.");

  // Non-official territory badge
  const nonOfficialBadge = c.official === false
    ? `<div class="non-official-badge">⚠️ Non-official territory — ${c.officialNote}</div>`
    : "";

  // Oil producer pill
  const producerPill = isProducer
    ? `<span class="producer-pill producer-yes">🛢️ Oil Producer</span>`
    : `<span class="producer-pill producer-no">📦 Non-Producer (100% Import)</span>`;

  // Top oil buyers section
  const buyers = detail.topOilBuyers || c.topOilBuyers || [];
  const buyersHTML = buyers.length ? `
    <div class="modal-section">
      <h4>🏢 Top Oil Buyers / Importers</h4>
      <div class="buyers-list">
        ${buyers.map(b => `
          <div class="buyer-item">
            <div class="buyer-name">${b.name} <span class="buyer-type">${b.type}</span></div>
            <div class="buyer-role">${b.role}</div>
            <div class="buyer-contact">📞 ${b.contact}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

  // New gas stations in progress
  const newStations = detail.newGasStations || c.newGasStations || [];
  const newStationsHTML = newStations.length ? `
    <div class="modal-section">
      <h4>🚧 New Gas Stations / Projects in Progress</h4>
      <div class="new-stations-list">
        ${newStations.map(s => `
          <div class="new-station-item">
            <div class="ns-name">${s.name}</div>
            <div class="ns-meta">${s.location} · <span class="ns-status">${s.status}</span> · ETA: ${s.eta}</div>
            <div class="ns-contact">📞 ${s.contact}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

  // Existing tracked stations
  const stationRows = (c.stations || []).map(s => `
    <li>
      <div>
        <div class="station-nm">${s.name}</div>
        <div class="station-ct">${s.city} · ${s.type}</div>
      </div>
      <span class="status-pill ${statusPillClass(s.status)}">${s.status}</span>
    </li>
  `).join("");

  const dangoteSection = c.dangoteOpportunity ? `
    <div class="modal-section">
      <h4>🎯 Dangote Opportunity</h4>
      <div class="modal-notes-box">${c.notes}</div>
    </div>` : "";

  document.getElementById("modalContent").innerHTML = `
    <div class="modal-country-header">
      <div class="modal-flag">${c.flag}</div>
      <div style="flex:1">
        <div class="modal-country-name">${c.name}</div>
        <div class="modal-status">
          <span class="card-status-badge badge-${c.status}">${c.status}</span>
          &nbsp; ${c.continent} &nbsp; ${producerPill}
        </div>
      </div>
    </div>

    ${nonOfficialBadge}
    <div class="modal-alert-box">⚠️ ${c.alert}</div>

    <div class="modal-section">
      <h4>🛢️ Oil Production Status</h4>
      <div class="modal-notes-box">${productionNote}</div>
    </div>

    <div class="modal-section">
      <h4>Supply Metrics</h4>
      <div class="modal-stats">
        <div class="modal-stat-item">
          <div class="modal-stat-label">Days of Supply Left</div>
          <div class="modal-stat-value" style="color:${getStatusColor(c.status)};font-size:1.6rem;font-family:monospace;">${c.reserveDays} days</div>
        </div>
        <div class="modal-stat-item">
          <div class="modal-stat-label">Current Reserves</div>
          <div class="modal-stat-value">${c.currentReserves_mb.toLocaleString()} M bbl</div>
        </div>
        <div class="modal-stat-item">
          <div class="modal-stat-label">Daily Consumption</div>
          <div class="modal-stat-value">${formatBPD(c.dailyConsumption_bpd)}</div>
        </div>
        <div class="modal-stat-item">
          <div class="modal-stat-label">Import Dependency</div>
          <div class="modal-stat-value">${c.importDependency}%</div>
        </div>
        <div class="modal-stat-item">
          <div class="modal-stat-label">Reserve Trend</div>
          <div class="modal-stat-value">${trendIcon(c.trend)} ${c.trend}</div>
        </div>
        <div class="modal-stat-item">
          <div class="modal-stat-label">Dangote Opp. Score</div>
          <div class="modal-stat-value" style="color:var(--dangote)">${c.opportunityScore} / 100</div>
        </div>
      </div>
    </div>

    ${dangoteSection}
    ${buyersHTML}
    ${newStationsHTML}

    ${(c.stations||[]).length ? `
    <div class="modal-section">
      <h4>⛽ Tracked Fuel Facilities (${c.stations.length})</h4>
      <ul class="station-list-modal">${stationRows}</ul>
    </div>` : ""}

    <div class="modal-section modal-telegram-row">
      <button class="btn-send-telegram" onclick="sendToTelegram('${countryId}')">
        ✈️ Send Report to Telegram
      </button>
      <button class="btn-tg-settings" onclick="openTelegramSettings()" title="Telegram settings">⚙️</button>
    </div>
  `;

  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

// ─── Telegram Integration ─────────────────────────────
function getTgConfig() {
  return {
    token:  localStorage.getItem("tg_token")  || "",
    chatId: localStorage.getItem("tg_chatid") || "",
  };
}

function openTelegramSettings() {
  const cfg = getTgConfig();
  const overlay = document.getElementById("tgSettingsOverlay");
  document.getElementById("tgTokenInput").value  = cfg.token;
  document.getElementById("tgChatIdInput").value = cfg.chatId;
  overlay.classList.add("open");
}

function closeTelegramSettings() {
  document.getElementById("tgSettingsOverlay").classList.remove("open");
}

function saveTelegramSettings() {
  const token  = document.getElementById("tgTokenInput").value.trim();
  const chatId = document.getElementById("tgChatIdInput").value.trim();
  if (!token || !chatId) { alert("Both Bot Token and Chat ID are required."); return; }
  localStorage.setItem("tg_token",  token);
  localStorage.setItem("tg_chatid", chatId);
  closeTelegramSettings();
  alert("Telegram settings saved!");
}

// ── shared Telegram send helper ──────────────────────
async function tgSend(token, chatId, html) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML" }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description);
}

// ── Country contact report — emails & phones of oil companies ─
async function sendToTelegram(countryId) {
  const cfg = getTgConfig();
  if (!cfg.token || !cfg.chatId) { openTelegramSettings(); return; }

  const c = OIL_DATA.countries.find(x => x.id === countryId)
         || (OIL_DATA.nonOfficialTerritories || []).find(x => x.id === countryId);
  if (!c) return;

  const detail  = COUNTRY_DETAILS[countryId] || {};
  const buyers  = detail.topOilBuyers  || c.topOilBuyers  || [];
  const newSt   = detail.newGasStations || c.newGasStations || [];
  const stations = c.stations || [];

  // Status badge
  const badge = c.status === "CRITICAL" ? "🔴 CRITICAL" :
                c.status === "WATCH"    ? "🟡 WATCH"    : "🟢 NORMAL";

  let msg = `📋 <b>OIL CONTACT REPORT — ${c.flag} ${c.name}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${badge} | ⏳ <b>${c.reserveDays} days</b> supply left | 📦 ${c.importDependency}% imported\n\n`;

  // ── Oil Buyers / Importers with contacts ──────────────
  if (buyers.length) {
    msg += `🏢 <b>OIL BUYERS &amp; IMPORTERS — CONTACT DIRECTORY</b>\n`;
    msg += `─────────────────────\n`;
    buyers.forEach((b, i) => {
      msg += `<b>${i + 1}. ${b.name}</b>\n`;
      msg += `   📌 ${b.type} — ${b.role}\n`;
      if (b.phone) msg += `   📞 ${b.phone}\n`;
      if (b.email) msg += `   📧 ${b.email}\n`;
      if (!b.phone && !b.email && b.contact) msg += `   🌐 ${b.contact}\n`;
      msg += `\n`;
    });
  }

  // ── Tracked Facilities in need of supply ──────────────
  const urgentStations = stations.filter(s =>
    s.status && !["Operational","Normal","Active"].includes(s.status)
  );
  if (urgentStations.length) {
    msg += `⛽ <b>TRACKED FACILITIES — NEED SUPPLY / AT RISK</b>\n`;
    msg += `─────────────────────\n`;
    urgentStations.forEach(s => {
      const urgency = ["Shutdown Planned","Closed 2021","Closed 2014","Closed (Supply)","Import Only"]
        .includes(s.status) ? "❌" :
        ["Reduced Output","Reduced Capacity","At Risk","Financial Risk","Cost Pressure"].includes(s.status) ? "⚠️" : "🔶";
      msg += `${urgency} <b>${s.name}</b>\n`;
      msg += `   📍 ${s.city} · ${s.type}\n`;
      msg += `   Status: ${s.status}\n`;
      if (s.phone) msg += `   📞 ${s.phone}\n`;
      if (s.email) msg += `   📧 ${s.email}\n`;
      msg += `\n`;
    });
  }

  // ── New stations / projects ────────────────────────────
  if (newSt.length) {
    msg += `🚧 <b>NEW PROJECTS / STATIONS</b>\n`;
    msg += `─────────────────────\n`;
    newSt.forEach(s => {
      msg += `• <b>${s.name}</b> — ${s.location}\n`;
      msg += `  ${s.status} | ETA: ${s.eta}\n`;
      if (s.phone) msg += `  📞 ${s.phone}\n`;
      if (s.email) msg += `  📧 ${s.email}\n`;
      if (!s.phone && !s.email && s.contact) msg += `  📞 ${s.contact}\n`;
    });
    msg += `\n`;
  }

  if (!buyers.length && !urgentStations.length && !newSt.length) {
    msg += `ℹ️ No detailed contact data available for this country yet.\n\n`;
    msg += `⚠️ ${c.alert}\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🌐 <a href="https://dinnudaniel.github.io/Oil-delepletion-tracker-/">Open Dashboard</a>`;

  try {
    await tgSend(cfg.token, cfg.chatId, msg);
    alert(`✅ Contact report for ${c.name} sent to Telegram!`);
  } catch (e) {
    alert(`❌ Telegram error: ${e.message}\n\nCheck your Bot Token and Chat ID in settings (⚙️).`);
  }
}

// ── Daily briefing — top 10 most urgent with contact info ─
async function sendDailyBriefing() {
  const cfg = getTgConfig();
  if (!cfg.token || !cfg.chatId) { openTelegramSettings(); return; }

  const allCountries = [
    ...(OIL_DATA.countries || []),
    ...(OIL_DATA.nonOfficialTerritories || []),
  ];

  // Score urgency: CRITICAL=2, WATCH=1, NORMAL=0 — then by fewest days remaining
  const urgencyRank = s => s.status === "CRITICAL" ? 2 : s.status === "WATCH" ? 1 : 0;
  const top10 = allCountries
    .filter(c => c.status === "CRITICAL" || c.status === "WATCH")
    .sort((a, b) => urgencyRank(b) - urgencyRank(a) || a.reserveDays - b.reserveDays)
    .slice(0, 10);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });

  try {
    // Message 1 — Header summary
    await tgSend(cfg.token, cfg.chatId,
      `📋 <b>DAILY OIL CONTACT BRIEFING</b>\n` +
      `📅 ${today}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Top 10 most urgent markets today.\n` +
      `Contact these companies — they urgently need oil supply.\n\n` +
      `🔴 CRITICAL markets tracked: ${allCountries.filter(c => c.status === "CRITICAL").length}\n` +
      `🟡 WATCH markets tracked:    ${allCountries.filter(c => c.status === "WATCH").length}\n\n` +
      `🏭 Dangote Refinery — 650,000 BPD ready to export.\n` +
      `🌐 <a href="https://dinnudaniel.github.io/Oil-delepletion-tracker-/">Open Dashboard</a>`
    );

    // Message 2 — Top 10 urgent contacts
    let lines = `📞 <b>TOP 10 URGENT — CALL &amp; EMAIL NOW</b>\n`;
    lines += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    top10.forEach((c, i) => {
      const detail   = COUNTRY_DETAILS[c.id] || {};
      const buyers   = detail.topOilBuyers || c.topOilBuyers || [];
      const badge    = c.status === "CRITICAL" ? "🔴" : "🟡";
      const topBuyer = buyers[0];

      lines += `<b>#${i + 1} ${badge} ${c.flag} ${c.name}</b>\n`;
      lines += `   ⏳ ${c.reserveDays} days supply | 📦 ${c.importDependency}% imported\n`;

      if (topBuyer) {
        lines += `   🏢 <b>${topBuyer.name}</b> (${topBuyer.type})\n`;
        if (topBuyer.phone) lines += `   📞 ${topBuyer.phone}\n`;
        if (topBuyer.email) lines += `   📧 ${topBuyer.email}\n`;
        if (!topBuyer.phone && !topBuyer.email && topBuyer.contact)
          lines += `   🌐 ${topBuyer.contact}\n`;
        lines += `   Role: ${topBuyer.role}\n`;
      } else {
        lines += `   ⚠️ ${c.alert}\n`;
      }
      lines += `\n`;
    });

    await tgSend(cfg.token, cfg.chatId, lines);

    // Message 3 — Full contact list for top 3 most critical countries
    for (const c of top10.slice(0, 3)) {
      const detail  = COUNTRY_DETAILS[c.id] || {};
      const buyers  = detail.topOilBuyers || c.topOilBuyers || [];
      const newSt   = detail.newGasStations || c.newGasStations || [];
      const stations = (c.stations || []).filter(s =>
        s.status && !["Operational","Normal","Active"].includes(s.status)
      );

      if (!buyers.length && !stations.length) continue;

      let cMsg = `📋 <b>FULL CONTACTS — ${c.flag} ${c.name}</b>\n`;
      cMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (buyers.length) {
        cMsg += `🏢 <b>OIL BUYERS:</b>\n`;
        buyers.forEach((b, i) => {
          cMsg += `<b>${i + 1}. ${b.name}</b>\n`;
          cMsg += `   ${b.type} — ${b.role}\n`;
          if (b.phone) cMsg += `   📞 ${b.phone}\n`;
          if (b.email) cMsg += `   📧 ${b.email}\n`;
          if (!b.phone && !b.email && b.contact) cMsg += `   🌐 ${b.contact}\n`;
          cMsg += `\n`;
        });
      }

      if (stations.length) {
        cMsg += `⛽ <b>FACILITIES IN NEED:</b>\n`;
        stations.forEach(s => {
          cMsg += `• <b>${s.name}</b> — ${s.status}\n`;
          if (s.phone) cMsg += `  📞 ${s.phone}\n`;
          if (s.email) cMsg += `  📧 ${s.email}\n`;
          cMsg += `\n`;
        });
      }

      if (newSt.length) {
        cMsg += `🚧 <b>NEW PROJECTS:</b>\n`;
        newSt.forEach(s => {
          cMsg += `• <b>${s.name}</b> — ${s.location} | ETA: ${s.eta}\n`;
          if (s.phone) cMsg += `  📞 ${s.phone}\n`;
          if (s.email) cMsg += `  📧 ${s.email}\n`;
          if (!s.phone && !s.email && s.contact) cMsg += `  📞 ${s.contact}\n`;
          cMsg += `\n`;
        });
      }

      await tgSend(cfg.token, cfg.chatId, cMsg);
    }

    alert("✅ Daily contact briefing sent to Telegram!");
  } catch (e) {
    alert(`❌ Telegram error: ${e.message}\n\nCheck your Bot Token and Chat ID in settings (⚙️).`);
  }
}

// Close modal on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    closeTelegramSettings();
  }
});


// ─── View Switcher ────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(`view-${name}`).classList.add("active");

  const btnMap = { dashboard: 0, opportunities: 1, stations: 2, countries: 3, dangote: 4 };
  const btns = document.querySelectorAll(".nav-btn");
  if (btnMap[name] !== undefined) btns[btnMap[name]].classList.add("active");
}

// ─── Helpers ──────────────────────────────────────────
function formatBPD(bpd) {
  if (bpd >= 1_000_000) return (bpd / 1_000_000).toFixed(2) + "M BPD";
  if (bpd >= 1_000)     return (bpd / 1_000).toFixed(0) + "K BPD";
  return bpd + " BPD";
}

function trendIcon(trend) {
  switch (trend) {
    case "declining": return "📉";
    case "stable":    return "➡️";
    case "improving": return "📈";
    default:          return "";
  }
}
