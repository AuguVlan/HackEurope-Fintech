import { useState, useEffect } from 'react'
import {
  getMetrics,
  getAdminTransactions,
  getAdminObligationsOpen,
  getAdminNetPositions,
  postSettleRun,
  postAdminTopup,
  getExportTransactionsUrl,
  getState,
  type AdminTransaction,
  type Obligation,
  type NetPosition,
} from './api'

function formatUsdCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`
}

function formatTs(ts: number | null | undefined): string {
  if (ts == null) return '—'
  return new Date(ts * 1000).toLocaleString()
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<{
    gross_usd_cents_open: number;
    net_usd_cents_if_settle_now: number;
    queued_count: number;
    transactions_today: number;
  } | null>(null)
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [netPositions, setNetPositions] = useState<NetPosition[]>([])
  const [accounts, setAccounts] = useState<{ id: string; kind: string; currency: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settleThreshold, setSettleThreshold] = useState('0')
  const [topupAccount, setTopupAccount] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [filters, setFilters] = useState({ from_ts: '', to_ts: '', type: '', currency: '' })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [m, txs, obl, net, state] = await Promise.all([
        getMetrics(),
        getAdminTransactions({
          limit: 200,
          from_ts: filters.from_ts ? Math.floor(new Date(filters.from_ts).getTime() / 1000) : undefined,
          to_ts: filters.to_ts ? Math.floor(new Date(filters.to_ts).getTime() / 1000) : undefined,
          type: filters.type || undefined,
          currency: filters.currency || undefined,
        }),
        getAdminObligationsOpen().then((r) => r.obligations),
        getAdminNetPositions().then((r) => r.net_positions),
        getState().catch(() => ({ accounts: [] as { id: string; kind: string; currency: string }[] })),
      ])
      setMetrics(m)
      setTransactions(txs)
      setObligations(obl)
      setNetPositions(net)
      const accs = state.accounts || []
      setAccounts(accs)
      setTopupAccount((prev) => {
        if (prev) return prev
        const first = accs.find((a) => a.kind === 'POOL')
        return first ? first.id : ''
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters.from_ts, filters.to_ts, filters.type, filters.currency])

  async function handleSettle() {
    const th = parseInt(settleThreshold, 10) || 0
    setError('')
    try {
      await postSettleRun(th)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleTopup() {
    if (!topupAccount || !topupAmount) return
    const amount = parseInt(topupAmount, 10)
    if (isNaN(amount) || amount <= 0) return
    setError('')
    try {
      await postAdminTopup(topupAccount, amount)
      setTopupAmount('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function exportCsv() {
    const params: Record<string, string> = {}
    if (filters.from_ts) params.from_ts = String(Math.floor(new Date(filters.from_ts).getTime() / 1000))
    if (filters.to_ts) params.to_ts = String(Math.floor(new Date(filters.to_ts).getTime() / 1000))
    if (filters.type) params.type = filters.type
    if (filters.currency) params.currency = filters.currency
    window.open(getExportTransactionsUrl(params), '_blank')
  }

  const poolAccounts = accounts.filter((a) => a.kind === 'POOL')

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Company Admin Dashboard</h2>

      {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}

      {metrics && (
        <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Gross open (USD)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatUsdCents(metrics.gross_usd_cents_open)}</div>
          </div>
          <div className="card">
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Net if settle now</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatUsdCents(metrics.net_usd_cents_if_settle_now)}</div>
          </div>
          <div className="card">
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Queued payouts</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{metrics.queued_count}</div>
          </div>
          <div className="card">
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Transactions today</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{metrics.transactions_today}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Actions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Settlement threshold (USD cents)</label>
            <input
              type="number"
              value={settleThreshold}
              onChange={(e) => setSettleThreshold(e.target.value)}
              style={{ width: '120px', marginRight: '0.5rem' }}
            />
            <button className="btn primary" onClick={handleSettle}>Run settlement</button>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Top up pool</label>
            <select
              value={topupAccount}
              onChange={(e) => setTopupAccount(e.target.value)}
              style={{ width: '140px', marginRight: '0.5rem' }}
            >
              <option value="">Select pool</option>
              {poolAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.id}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount (minor)"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              style={{ width: '120px', marginRight: '0.5rem' }}
            />
            <button className="btn primary" onClick={handleTopup}>Top up</button>
          </div>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Open obligations</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>From</th>
              <th>To</th>
              <th>Amount (USD cents)</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.from_pool}</td>
                <td>{o.to_pool}</td>
                <td>{o.amount_usd_cents}</td>
                <td>{o.status}</td>
                <td>{formatTs(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {obligations.length === 0 && !loading && <p style={{ padding: '1rem', color: '#64748b' }}>No open obligations</p>}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Net positions (pool pairs)</h3>
        <table>
          <thead>
            <tr>
              <th>Pool A</th>
              <th>Pool B</th>
              <th>Net (USD cents)</th>
              <th>Abs</th>
            </tr>
          </thead>
          <tbody>
            {netPositions.map((n, i) => (
              <tr key={i}>
                <td>{n.pool_a}</td>
                <td>{n.pool_b}</td>
                <td>{n.net_usd_cents}</td>
                <td>{formatUsdCents(n.abs_usd_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {netPositions.length === 0 && !loading && <p style={{ padding: '1rem', color: '#64748b' }}>No net positions</p>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>All transactions</h3>
        <div className="filters">
          <label>From <input type="date" value={filters.from_ts} onChange={(e) => setFilters((f) => ({ ...f, from_ts: e.target.value }))} /></label>
          <label>To <input type="date" value={filters.to_ts} onChange={(e) => setFilters((f) => ({ ...f, to_ts: e.target.value }))} /></label>
          <label>
            Type
            <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
              <option value="">All</option>
              <option value="PAYOUT">PAYOUT</option>
              <option value="TOPUP">TOPUP</option>
              <option value="QUEUED_PAYOUT">QUEUED_PAYOUT</option>
            </select>
          </label>
          <label>
            Currency
            <select value={filters.currency} onChange={(e) => setFilters((f) => ({ ...f, currency: e.target.value }))}>
              <option value="">All</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Account</th>
              <th>Direction</th>
              <th>Amount (minor)</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={`${t.id}-${t.posting_id}`}>
                <td>{t.id}</td>
                <td>{t.type}</td>
                <td>{t.account_id ?? '—'}</td>
                <td>{t.direction ?? '—'}</td>
                <td>{t.amount_minor}</td>
                <td>{formatTs(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && !loading && <p style={{ padding: '1rem', color: '#64748b' }}>No transactions</p>}
      </div>
    </div>
  )
}
