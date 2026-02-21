import { useState, useEffect } from 'react'
import {
  listWorkers,
  getWorkerBalance,
  getWorkerTransactions,
  getWorkerSummary,
  type WorkerTransaction,
} from './api'

function formatMinor(amount: number, currency: string): string {
  const value = (amount / 100).toFixed(2)
  const symbols: Record<string, string> = { GBP: '£', EUR: '€', BRL: 'R$', USD: '$' }
  return `${symbols[currency] || currency} ${value}`
}

function formatTs(ts: number | null): string {
  if (ts == null) return '—'
  return new Date(ts * 1000).toLocaleString()
}

export default function WorkerPortal() {
  const [workers, setWorkers] = useState<{ id: string; country?: string; currency?: string }[]>([])
  const [workerId, setWorkerId] = useState('')
  const [balance, setBalance] = useState<{ balance_minor: number; currency: string } | null>(null)
  const [summary, setSummary] = useState<{ transaction_count: number } | null>(null)
  const [transactions, setTransactions] = useState<WorkerTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<WorkerTransaction | null>(null)
  const [filters, setFilters] = useState({ from_ts: '', to_ts: '', type: '', searchId: '' })

  useEffect(() => {
    setError('')
    listWorkers()
      .then((r) => {
        const list = r.workers || []
        setWorkers(list)
        if (list.length > 0 && !workerId) setWorkerId(list[0].id)
      })
      .catch((e) => setError(e?.message || 'Failed to load workers'))
  }, [])

  useEffect(() => {
    if (!workerId || workerId.trim() === '') return
    setLoading(true)
    setError('')
    const from_ts = filters.from_ts ? Math.floor(new Date(filters.from_ts).getTime() / 1000) : undefined
    const to_ts = filters.to_ts ? Math.floor(new Date(filters.to_ts).getTime() / 1000) : undefined
    Promise.all([
      getWorkerBalance(workerId),
      getWorkerSummary(workerId),
      getWorkerTransactions(workerId, {
        limit: 100,
        from_ts,
        to_ts,
        type: filters.type || undefined,
      }),
    ])
      .then(([bal, sum, txs]) => {
        setBalance(bal)
        setSummary(sum)
        let list = Array.isArray(txs) ? txs : []
        if (filters.searchId) {
          const id = filters.searchId.trim()
          list = list.filter((t) => String(t.id) === id || String(t.posting_id) === id)
        }
        setTransactions(list)
      })
      .catch((e) => setError(e?.message || 'Failed to load worker data'))
      .finally(() => setLoading(false))
  }, [workerId, filters.from_ts, filters.to_ts, filters.type, filters.searchId])

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Gig Worker Portal</h2>
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Select your worker account to view balance and transaction history (auth mocked).
      </p>

      {workers.length === 0 && !error && (
        <p style={{ padding: '1rem', background: '#fef3c7', borderRadius: 8, marginBottom: '1rem' }}>
          No workers found. Make sure the backend is running and run <strong>POST /init</strong> to seed the database (or restart the server).
        </p>
      )}
      <div className="filters" style={{ marginBottom: '1rem' }}>
        <label>
          Worker
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
            disabled={workers.length === 0}
          >
            <option value="">Select worker</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.id} ({w.currency ?? ''})
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from_ts}
            onChange={(e) => setFilters((f) => ({ ...f, from_ts: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to_ts}
            onChange={(e) => setFilters((f) => ({ ...f, to_ts: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <label>
          Type
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="">All</option>
            <option value="PAYOUT">PAYOUT</option>
            <option value="TOPUP">TOPUP</option>
            <option value="QUEUED_PAYOUT">QUEUED_PAYOUT</option>
          </select>
        </label>
        <label>
          Search ID
          <input
            type="text"
            placeholder="Entry or posting id"
            value={filters.searchId}
            onChange={(e) => setFilters((f) => ({ ...f, searchId: e.target.value }))}
            style={{ marginLeft: '0.5rem', width: '120px' }}
          />
        </label>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}

      {balance && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Balance</h3>
          <p style={{ fontSize: '1.5rem', margin: 0 }}>
            {formatMinor(balance.balance_minor, balance.currency)}
          </p>
          {summary && <p style={{ color: '#64748b', marginBottom: 0 }}>{summary.transaction_count} transactions</p>}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Transaction history</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Direction</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={`${t.id}-${t.posting_id}`}>
                <td>{t.id}</td>
                <td>{t.type}</td>
                <td>{formatMinor(t.amount_minor, t.currency)}</td>
                <td>{t.direction ?? '—'}</td>
                <td>{t.status}</td>
                <td>{formatTs(t.created_at)}</td>
                <td>
                  <button className="btn" onClick={() => setDetail(t)}>Detail</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && !loading && <p style={{ padding: '1rem', color: '#64748b' }}>No transactions</p>}
      </div>

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Transaction detail</h3>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem' }}>
              <dt>ID</dt><dd>{detail.id}</dd>
              <dt>Posting ID</dt><dd>{detail.posting_id ?? '—'}</dd>
              <dt>Type</dt><dd>{detail.type}</dd>
              <dt>Amount</dt><dd>{formatMinor(detail.amount_minor, detail.currency)}</dd>
              <dt>Currency</dt><dd>{detail.currency}</dd>
              <dt>Direction</dt><dd>{detail.direction ?? '—'}</dd>
              <dt>Status</dt><dd>{detail.status}</dd>
              <dt>Timestamp</dt><dd>{formatTs(detail.created_at)}</dd>
              <dt>Metadata</dt><dd style={{ wordBreak: 'break-all' }}>{detail.metadata_json ?? '—'}</dd>
            </dl>
            <button className="btn primary" style={{ marginTop: '1rem' }} onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
