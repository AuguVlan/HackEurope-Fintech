/* ============================================================
   Synthetic Liquidity Ledger — Frontend Application
   ============================================================ */

const API = 'http://localhost:8000';

// ─── Helpers ────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || res.statusText);
  }
  return res.json();
}

const SYMBOLS = { GBP: '£', EUR: '€', BRL: '₱', USD: '$', NGN: '₦' };
function fmtCurrency(minor, cur) {
  const sym = SYMBOLS[cur] || cur + ' ';
  return sym + (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtUSD(cents) { return fmtCurrency(cents, 'USD'); }
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function statusBadge(s) {
  const cls = { open: 'badge-open', settled: 'badge-settled', queued: 'badge-queued', pending: 'badge-open', executed: 'badge-settled', failed: 'badge-failed' };
  return `<span class="badge ${cls[s?.toLowerCase()] || 'badge-open'}">${s || '—'}</span>`;
}

// sparkline SVG
function sparklineSVG(data, w = 200, h = 40) {
  if (!data.length) return '';
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
}
function randomSparkline(n = 12) {
  const d = []; let v = 50;
  for (let i = 0; i < n; i++) { v += (Math.random() - .45) * 18; v = Math.max(10, Math.min(90, v)); d.push(v); }
  return d;
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function $(id) { return document.getElementById(id); }

// ─── Navigation ─────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
  const target = $(`page-${page}`);
  const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
  // Load page data
  if (page === 'dashboard') loadDashboard();
  if (page === 'workers') loadWorkersList();
  if (page === 'obligations') loadFullObligations();
  if (page === 'settlement') loadNetPositions();
  if (page === 'ingestion') loadIngestionHealth();
}

document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});

// Mobile menu
$('menuToggle').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

// ─── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [state, metrics] = await Promise.all([
      api('/state'),
      api('/metrics'),
    ]);
    renderBalanceCards(state.accounts);
    renderObligationsSummary(state.open_obligations, metrics);
    renderLiquidityHealth(state.accounts);
    renderKPIs(metrics, state.accounts.length);
    renderActivityFeed(state.open_obligations);
  } catch (err) {
    toast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderBalanceCards(accounts) {
  // Group by currency
  const groups = {};
  accounts.forEach(a => {
    if (!groups[a.currency]) groups[a.currency] = { total: 0, count: 0 };
    groups[a.currency].total += a.balance_minor;
    groups[a.currency].count += 1;
  });
  const grid = $('balanceGrid');
  grid.innerHTML = Object.entries(groups).map(([cur, g]) => {
    const change = (Math.random() * 6 - 1).toFixed(1);
    const sign = change >= 0 ? '+' : '';
    return `
      <div class="balance-card">
        <span class="trend-icon">📈</span>
        <div class="currency-label">Total ${cur}</div>
        <div class="balance-value">${fmtCurrency(g.total, cur)}</div>
        ${sparklineSVG(randomSparkline())}
        <div class="balance-footer">
          <span class="pool-count">${g.count} pools</span>
          <span class="change">${sign}${change}% this month</span>
        </div>
      </div>`;
  }).join('');
}

function renderObligationsSummary(obligations, metrics) {
  $('metricGross').textContent = fmtUSD(metrics.gross_usd_cents_open);
  $('metricNet').textContent = fmtUSD(metrics.net_usd_cents_if_settle_now);
  const gross = metrics.gross_usd_cents_open || 0;
  const net = metrics.net_usd_cents_if_settle_now || 0;
  const comp = gross > 0 ? ((gross - net) / gross * 100).toFixed(0) : 0;
  $('metricCompression').textContent = comp + '%';

  const body = $('obligationsBody');
  if (!obligations.length) {
    body.innerHTML = '<tr><td colspan="4" class="text-muted">No open obligations</td></tr>';
    return;
  }
  body.innerHTML = obligations.slice(0, 5).map(o => `
    <tr>
      <td><code>${o.from_pool}</code></td>
      <td><code>${o.to_pool}</code></td>
      <td>${fmtUSD(o.amount_usd_cents)}</td>
      <td>${statusBadge(o.status)}</td>
    </tr>`).join('');
}

function renderLiquidityHealth(accounts) {
  const container = $('liquidityBars');
  if (!accounts.length) { container.innerHTML = '<p class="text-muted">No accounts</p>'; return; }
  const maxBal = Math.max(...accounts.map(a => a.balance_minor), 1);
  container.innerHTML = accounts.map(a => {
    const pct = (a.balance_minor / maxBal * 100).toFixed(0);
    const ratio = a.min_buffer_minor > 0 ? a.balance_minor / a.min_buffer_minor : 999;
    const color = ratio >= 2 ? 'var(--secondary)' : ratio >= 1 ? 'var(--warning)' : 'var(--danger)';
    return `
      <div class="health-bar-row">
        <span class="health-pool-name">${a.id}</span>
        <div class="health-bar-track">
          <div class="health-bar-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <span class="health-pct" style="color:${color}">${pct}%</span>
      </div>`;
  }).join('');
}

function renderKPIs(metrics, accountCount) {
  $('kpiGross').textContent = fmtUSD(metrics.gross_usd_cents_open);
  $('kpiNet').textContent = fmtUSD(metrics.net_usd_cents_if_settle_now);
  $('kpiQueued').textContent = metrics.queued_count;
  $('kpiAccounts').textContent = accountCount;
}

function renderActivityFeed(obligations) {
  const feed = $('activityFeed');
  const items = [];
  // Generate mock activity from obligations
  obligations.forEach((o, i) => {
    items.push({
      icon: 'send', cls: 'send',
      text: `Obligation created: ${o.from_pool} → ${o.to_pool} for ${fmtUSD(o.amount_usd_cents)}`,
      time: fmtDate(o.created_at),
    });
  });
  if (!items.length) {
    items.push({ icon: '📭', cls: 'settle', text: 'No recent activity', time: 'now' });
  }
  feed.innerHTML = items.slice(0, 6).map(it => `
    <div class="activity-item">
      <div class="activity-icon ${it.cls}">${it.icon === 'send' ? '📤' : it.icon}</div>
      <div>
        <div class="activity-text">${it.text}</div>
        <div class="activity-time">${it.time}</div>
      </div>
    </div>`).join('');
}

// ─── Workers ────────────────────────────────────────────────
async function loadWorkersList() {
  try {
    const data = await api('/workers');
    const sel = $('workerSelect');
    sel.innerHTML = '<option value="">— Select worker —</option>';
    (data.workers || []).forEach(w => {
      sel.innerHTML += `<option value="${w.id}">${w.id} (${w.currency || '?'} / ${w.country || '?'})</option>`;
    });
  } catch (err) {
    toast('Could not load workers: ' + err.message, 'error');
  }
}

$('btnLoadWorker').addEventListener('click', async () => {
  const id = $('workerSelect').value;
  if (!id) return toast('Select a worker first', 'info');
  try {
    const [balance, txs] = await Promise.all([
      api(`/worker/${id}/balance`),
      api(`/worker/${id}/transactions?limit=50`),
    ]);
    $('workerDetail').style.display = '';
    $('workerBalanceGrid').innerHTML = `
      <div class="balance-card">
        <span class="trend-icon">👷</span>
        <div class="currency-label">${balance.worker_id}</div>
        <div class="balance-value">${fmtCurrency(balance.balance_minor, balance.currency)}</div>
        ${sparklineSVG(randomSparkline())}
        <div class="balance-footer">
          <span class="pool-count">${balance.currency} / ${balance.country || '?'}</span>
          <span class="change">${txs.length} transactions</span>
        </div>
      </div>`;
    const body = $('workerTxBody');
    if (!txs.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-muted">No transactions</td></tr>';
    } else {
      body.innerHTML = txs.map(t => `
        <tr>
          <td>${t.id}</td>
          <td>${statusBadge(t.type)}</td>
          <td>${fmtCurrency(t.amount_minor, t.currency || 'USD')}</td>
          <td>${t.direction || '—'}</td>
          <td>${fmtDate(t.created_at)}</td>
        </tr>`).join('');
    }
  } catch (err) {
    toast('Failed to load worker: ' + err.message, 'error');
  }
});

// ─── Obligations page ───────────────────────────────────────
async function loadFullObligations() {
  try {
    const data = await api('/admin/obligations/open');
    const body = $('fullObligationsBody');
    const obs = data.obligations || [];
    $('noObligations').style.display = obs.length ? 'none' : '';
    body.innerHTML = obs.map(o => `
      <tr>
        <td>${o.id}</td>
        <td><code>${o.from_pool}</code></td>
        <td><code>${o.to_pool}</code></td>
        <td>${fmtUSD(o.amount_usd_cents)}</td>
        <td>${statusBadge(o.status)}</td>
      </tr>`).join('');
  } catch (err) {
    toast('Failed to load obligations: ' + err.message, 'error');
  }
}

// ─── Settlement page ────────────────────────────────────────
$('btnSettle').addEventListener('click', async () => {
  const threshold = Number($('settleThreshold').value) || 0;
  try {
    const result = await api('/settle/run', {
      method: 'POST',
      body: JSON.stringify({ threshold_usd_cents: threshold }),
    });
    const box = $('settleResult');
    box.style.display = '';
    box.textContent = JSON.stringify(result, null, 2);
    toast(result.ok ? 'Settlement executed!' : (result.message || 'Settlement done'), result.ok ? 'success' : 'info');
    loadNetPositions();
  } catch (err) {
    toast('Settlement failed: ' + err.message, 'error');
  }
});

async function loadNetPositions() {
  try {
    const data = await api('/admin/net_positions');
    const body = $('netPositionsBody');
    const positions = data.net_positions || [];
    if (!positions.length) {
      body.innerHTML = '<tr><td colspan="4" class="text-muted">No positions</td></tr>';
      return;
    }
    body.innerHTML = positions.map(p => `
      <tr>
        <td><code>${p.pool_a}</code></td>
        <td><code>${p.pool_b}</code></td>
        <td>${fmtUSD(p.net_usd_cents)}</td>
        <td>${fmtUSD(p.abs_usd_cents)}</td>
      </tr>`).join('');
  } catch (err) {
    toast('Failed to load positions: ' + err.message, 'error');
  }
}

// ─── Ingestion page ─────────────────────────────────────────
async function loadIngestionHealth() {
  try {
    const data = await api('/ingestion/health');
    const container = $('ingestionHealth');
    const repos = data.repositories || [];
    container.innerHTML = repos.map(r => `
      <div class="kpi">
        <span class="kpi-icon">${r.alive ? '🟢' : '🔴'}</span>
        <span class="kpi-label">${r.name}</span>
        <span class="kpi-value">${r.alive ? 'Online' : 'Offline'}</span>
      </div>`).join('') || '<div class="kpi"><span class="kpi-icon">✅</span><span class="kpi-label">Pipeline</span><span class="kpi-value">Healthy</span></div>';
  } catch (err) {
    $('ingestionHealth').innerHTML = '<div class="kpi"><span class="kpi-icon">⚠️</span><span class="kpi-label">Pipeline</span><span class="kpi-value">Unreachable</span></div>';
  }
}

$('btnIngest').addEventListener('click', async () => {
  const workerId = $('ingestWorkerId').value.trim();
  const delta = Number($('ingestDelta').value) || 500;
  if (!workerId) return toast('Enter a worker ID', 'info');
  try {
    const result = await api(`/ingestion/ingest/${workerId}?delta=${delta}`);
    const box = $('ingestResult');
    box.style.display = '';
    const smoothing = result.smoothing || {};
    box.textContent = JSON.stringify(result, null, 2);
    toast(`Income state: ${smoothing.state || '?'} | Baseline: ${smoothing.baseline_minor || 0}`, 'success');
  } catch (err) {
    toast('Ingestion failed: ' + err.message, 'error');
  }
});

// ─── Boot ───────────────────────────────────────────────────
loadDashboard();
