import { useState } from 'react'
import WorkerPortal from './WorkerPortal'
import AdminDashboard from './AdminDashboard'

type Tab = 'worker' | 'admin'

export default function App() {
  const [tab, setTab] = useState<Tab>('worker')

  return (
    <div>
      <header style={{ background: '#1e293b', color: '#fff', padding: '0.75rem 1rem' }}>
        <div className="layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Synthetic Liquidity Ledger</h1>
          <nav className="tabs" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <button
              className={tab === 'worker' ? 'active' : ''}
              onClick={() => setTab('worker')}
              style={{ color: tab === 'worker' ? '#fff' : '#94a3b8', borderBottomColor: tab === 'worker' ? '#60a5fa' : 'transparent' }}
            >
              Gig Worker Portal
            </button>
            <button
              className={tab === 'admin' ? 'active' : ''}
              onClick={() => setTab('admin')}
              style={{ color: tab === 'admin' ? '#fff' : '#94a3b8', borderBottomColor: tab === 'admin' ? '#60a5fa' : 'transparent' }}
            >
              Company Admin
            </button>
          </nav>
        </div>
      </header>
      <main className="layout" style={{ paddingTop: '1.5rem' }}>
        {tab === 'worker' && <WorkerPortal />}
        {tab === 'admin' && <AdminDashboard />}
      </main>
    </div>
  )
}
