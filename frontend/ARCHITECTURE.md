# Frontend Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              React Application (Dashboard)                │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐│ │
│  │  │  Main App Component (App.tsx)                         ││ │
│  │  │  └─ QueryClientProvider                              ││ │
│  │  │     └─ DashboardContent                              ││ │
│  │  └──────────────────────────────────────────────────────┘│ │
│  │     │                                                     │ │
│  │  ┌──┴───────────────────────────────────────────────────┐│ │
│  │  │  Layout Container                                     ││ │
│  │  │  ├─ Sidebar (Navigation)                             ││ │
│  │  │  │  ├─ Dashboard                                      ││ │
│  │  │  │  ├─ Ledger                                         ││ │
│  │  │  │  ├─ Workers                                        ││ │
│  │  │  │  ├─ Obligations                                    ││ │
│  │  │  │  ├─ Settlement                                     ││ │
│  │  │  │  └─ Metrics                                        ││ │
│  │  │  │                                                     ││ │
│  │  │  └─ Main Content Area                                 ││ │
│  │  │     ├─ Navbar (Top)                                   ││ │
│  │  │     │  ├─ Menu Toggle                                 ││ │
│  │  │     │  ├─ Page Title                                  ││ │
│  │  │     │  ├─ Environment Badge (DEV)                     ││ │
│  │  │     │  └─ User Profile                                ││ │
│  │  │     │                                                  ││ │
│  │  │     └─ Content Grid                                   ││ │
│  │  │        ├─ BalanceGrid (Top)                           ││ │
│  │  │        │  ├─ BalanceCard (GBP)                        ││ │
│  │  │        │  ├─ BalanceCard (BRL)                        ││ │
│  │  │        │  └─ BalanceCard (EUR)                        ││ │
│  │  │        │                                               ││ │
│  │  │        ├─ Main Grid (2 columns)                        ││ │
│  │  │        │  ├─ Left Column                              ││ │
│  │  │        │  │  ├─ ObligationsPanel                      ││ │
│  │  │        │  │  └─ LiquidityHealthPanel                  ││ │
│  │  │        │  │                                             ││ │
│  │  │        │  └─ Right Column                              ││ │
│  │  │        │     ├─ MetricsPanel                           ││ │
│  │  │        │     └─ ActivityFeed                           ││ │
│  │  │        │                                                ││ │
│  │  │        └─ WorkerTransactionTable (Full Width)         ││ │
│  │  │                                                         ││ │
│  │  └──────────────────────────────────────────────────────┘│ │
│  │                                                            │ │
│  │  Data Layer (React Query)                                 │ │
│  │  ├─ useLedgerState()  ←─ GET /state (5s refresh)        │ │
│  │  ├─ useMetrics()      ←─ GET /metrics (5s refresh)      │ │
│  │  └─ [Cache]                                              │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                          ↓                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  HTTP Client (Axios)                                      │ │
│  │  └─ API Gateway                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓ HTTP
         ┌────────────────────────────────┐
         │   Backend API (FastAPI)        │
         │   :8000                        │
         │                                │
         │  ├─ GET /state                 │
         │  ├─ GET /metrics               │
         │  ├─ POST /settle/run           │
         │  ├─ POST /payout               │
         │  ├─ POST /admin/topup          │
         │  └─ ... other endpoints        │
         │                                │
         └────────────────────────────────┘
                     ↓ SQL
         ┌────────────────────────────────┐
         │   SQLite Database              │
         │   (ledger.db)                  │
         │                                │
         │  ├─ accounts                   │
         │  ├─ fx_rates                   │
         │  ├─ journal_entries            │
         │  ├─ postings                   │
         │  ├─ obligations                │
         │  ├─ settlement_batches         │
         │  └─ payout_queue               │
         └────────────────────────────────┘
```

## Component Hierarchy

```
App.tsx (Root)
│
└─ Dashboard.tsx (Main Page)
   │
   ├─ QueryClientProvider
   │
   ├─ Layout.tsx
   │  ├─ Sidebar
   │  │  └─ NavItem[] (6 items)
   │  │
   │  └─ Navbar
   │     ├─ MenuToggle
   │     ├─ PageTitle
   │     ├─ EnvironmentBadge
   │     └─ UserProfile
   │
   ├─ BalanceGrid
   │  └─ BalanceCard[] (3-5 cards)
   │
   ├─ ObligationsPanel
   │  ├─ MetricsDisplay
   │  │  ├─ GrossExposure
   │  │  ├─ NetExposure
   │  │  └─ CompressionRatio
   │  │
   │  └─ PoolPairs
   │     └─ PoolPair[] (top 5)
   │
   ├─ LiquidityHealthPanel
   │  └─ PoolHealth[] (per account)
   │     ├─ HealthBadge
   │     ├─ ProgressBar
   │     └─ BufferRatio
   │
   ├─ MetricsPanel
   │  ├─ Stat (Gross Exposure)
   │  ├─ Stat (Net Exposure)
   │  ├─ RadialChart (Compression)
   │  ├─ Stat (Queued Payouts)
   │  └─ Stat (Transactions Today)
   │
   ├─ ActivityFeed
   │  └─ ActivityItem[] (5 items)
   │     ├─ Icon
   │     ├─ Description
   │     └─ Timestamp
   │
   └─ WorkerTransactionTable
      ├─ SearchInput
      ├─ StatusFilter
      ├─ DataTable
      │  ├─ TableHeader
      │  └─ TableRow[] (paginated)
      │
      └─ Pagination
         ├─ PreviousButton
         ├─ PageSelector[]
         └─ NextButton
```

## Data Flow

```
User Opens Dashboard
        │
        ↓
   React Mounts
        │
        ↓
   useQuery Hooks Activate
   ├─ useLedgerState()
   ├─ useMetrics()
   └─ [Subscribe to auto-refresh]
        │
        ↓
   API Requests Sent
   ├─ GET /state
   └─ GET /metrics
        │
        ↓
   Response Data Received
        │
        ↓
   React Query Caches Data
   (staleTime: 2000ms)
        │
        ↓
   Components Receive Props
   ├─ Dashboard gets data
   └─ Passes to child components
        │
        ↓
   Component Rendering
   ├─ Balance cards render
   ├─ Table renders
   ├─ Panels render
   └─ Charts render (Recharts)
        │
        ↓
   UI Displayed to User
        │
        ├─ Every 5 seconds:
        │  └─ Auto-refetch queries
        │     └─ Update cache
        │        └─ Components re-render
        │
        └─ On User Action:
           └─ POST request (settle, topup, etc)
              ├─ Optimistic update
              ├─ Toast notification
              └─ Invalidate queries
                 └─ Auto-refetch
                    └─ Update UI
```

## Styling Architecture

```
Tailwind CSS Pipeline
        │
        ├─ tailwind.config.ts
        │  ├─ Dark mode settings
        │  ├─ Color palette
        │  ├─ Spacing scale
        │  ├─ Typography
        │  └─ Rounded corners (2xl)
        │
        ├─ postcss.config.js
        │  ├─ Tailwind CSS plugin
        │  └─ Autoprefixer
        │
        ├─ index.css
        │  ├─ @tailwind base
        │  ├─ @tailwind components
        │  │  └─ Custom classes (.glass, .btn-primary, etc)
        │  ├─ @tailwind utilities
        │  └─ Custom CSS variables
        │
        └─ Components
           ├─ Use Tailwind classes directly
           ├─ Apply custom utilities (.glass, .btn-primary)
           └─ Use CSS variables for colors
```

## Request/Response Flow

```
User Clicks "Run Settlement"
        │
        ↓
Dashboard detects click
        │
        ↓
handleSettleClick() executes
        │
        ├─ Set loading state
        ├─ Show "Settling..." toast
        └─ Disable button
        │
        ↓
api.runSettlement() called
        │
        ├─ Build request body:
        │  └─ { threshold_usd_cents: 0 }
        │
        └─ POST /settle/run
           ├─ Headers: Content-Type: application/json
           └─ Axios sends request
        │
        ↓
Backend Processes (FastAPI)
        │
        ├─ Validate input
        ├─ Compute net positions
        ├─ Update obligations
        ├─ Return result
        │
        └─ Response:
           └─ {
              "ok": true,
              "settlement_batch_id": 42,
              "settlement_count": 3,
              "settlements": [...]
           }
        │
        ↓
Frontend Receives Response
        │
        ├─ Check if ok === true
        ├─ Show success toast
        ├─ Clear loading state
        └─ Invalidate queries
           └─ useLedgerState().refetch()
              └─ useLedgerState().refetch()
        │
        ↓
Components Re-render with New Data
        │
        ├─ Balance cards update
        ├─ Obligations panel refreshes
        ├─ Metrics update
        └─ Activity feed shows new entry
        │
        ↓
User Sees Updated Dashboard
```

## Mobile Responsive Behavior

```
Desktop (>1024px)
┌─────────────────────────────────────────────┐
│ [Sidebar] │    Main Content                 │
│           │ ┌─ Navbar                       │
│ • Dash    │ │                                │
│ • Ledger  │ │ [Card] [Card] [Card]          │
│ • Workers │ │ [        Large Panel        ] │
│           │ │ [Panel] [Panel] [Panel]       │
│ • ...     │ │ [    Transaction Table      ] │
│           │ └─                               │
└─────────────────────────────────────────────┘

Tablet (640-1024px)
┌──────────────────────┐
│  Navbar              │
│ [Menu] [Title] [👤]  │
├──────────────────────┤
│  ☰ Sidebar (off)     │
│                      │
│ [Card]     [Card]    │
│            [Card]    │
│ [Panel]    [Panel]   │
│ [Panel]    [Panel]   │
│            [Panel]   │
│ [  Trans. Table    ] │
└──────────────────────┘

Mobile (<640px)
┌──────────────────┐
│☰ Navbar          │
│ Title       [👤] │
├──────────────────┤
│ [Sidebar]        │
│ (Slide-in)       │
│                  │
│ [Card]           │
│ [Card]           │
│ [Card]           │
│ [Panel - Scroll] │
│ [Panel - Scroll] │
│ [Table - Scroll] │
└──────────────────┘
```

## Redux Store (Future)

```
Store (Not Currently Used - React Query Instead)
│
└─ Slices (if needed)
   ├─ ledgerSlice
   │  ├─ accounts[]
   │  ├─ obligations[]
   │  └─ queued_payouts[]
   │
   ├─ metricsSlice
   │  ├─ gross_usd_cents_open
   │  ├─ net_usd_cents_if_settle_now
   │  └─ queued_count
   │
   └─ uiSlice
      ├─ sidebarOpen
      ├─ selectedTransaction
      └─ notifications[]
```

## Error Handling Flow

```
API Request Made
        │
        ├─ Network Error
        │  └─ Toast: "Connection failed"
        │     └─ Retry with exponential backoff
        │
        ├─ 4xx Error (Client)
        │  └─ Toast: Error message from API
        │     └─ Don't retry
        │
        ├─ 5xx Error (Server)
        │  └─ Toast: "Server error"
        │     └─ Retry with backoff
        │
        └─ Success (200)
           └─ Update cache
              └─ Components re-render
```

---

**Diagram Version**: 1.0
**Created**: February 21, 2026
