# Synthetic Liquidity Ledger - Admin Dashboard Frontend

A modern, production-grade financial infrastructure dashboard UI built with React, TypeScript, and Tailwind CSS.

## ✨ Features

### Visual Design
- **Dark Mode by Default** - Premium black/charcoal aesthetic with glassmorphism effects
- **Glassmorphism Cards** - Frosted glass effect with subtle borders and shadows
- **2xl Rounded Corners** - Premium rounded corners on all elements
- **Responsive Layout** - Fully responsive from mobile to 4K displays
- **Fintech Aesthetic** - Similar to Stripe/Linear/Vercel dashboards

### Core Components

#### 1. Balance Overview
- **Multi-Currency Display** - GBP, BRL, EUR, USD totals
- **Sparkline Charts** - Mini trend charts for each currency
- **Percentage Changes** - Monthly performance indicators
- **Account Grouping** - Total balances aggregated by currency

#### 2. Transaction History Table
- **Advanced Search** - Search by account ID or transaction type
- **Status Filtering** - Filter by EXECUTED, QUEUED, or PENDING
- **Pagination** - 10 items per page with next/previous navigation
- **Sortable Columns** - Click to sort by any column
- **Detail Drawer** - Click row to view full transaction details

#### 3. Open Obligations Panel
- **Gross Exposure** - Total USD cents of all open obligations
- **Net Exposure** - Netting position after settlements
- **Compression Ratio** - Efficiency metric (saved vs. gross)
- **Top Pool Pairs** - Top 5 pool pairs by exposure
- **Settlement Button** - One-click settlement execution

#### 4. Liquidity Health Panel
- **Buffer Utilization** - Visual progress bars for each pool
- **Status Indicators** - Healthy/Warning/Critical badges
- **Min Buffer Display** - Current vs. minimum liquidity
- **Color Coding** - Green (healthy) → Yellow (warning) → Red (critical)

#### 5. Key Metrics
- **Gross & Net Exposure** - In USD with color indicators
- **Settlement Compression** - Radial chart showing compression ratio
- **Queued Payouts** - Count of items in queue
- **Transactions Today** - Daily transaction volume

#### 6. Activity Feed
- **Event Timeline** - Chronological list of ledger events
- **Event Types**:
  - Payout Executed (Send icon)
  - Obligation Created (File icon)
  - Settlement Batch (Check icon)
  - Liquidity Top-up (Trending Up icon)
  - Payout Queued (Clock icon)
- **Timestamps** - Formatted time for each event

#### 7. Navigation
- **Sidebar Navigation** - Collapsible on mobile
- **Top Navbar** - System status and environment indicator
- **Menu Items**:
  - Dashboard
  - Ledger
  - Workers
  - Obligations
  - Settlement
  - Metrics

## 🛠 Tech Stack

```
Frontend Framework: React 18.2
Language: TypeScript 5.2
Styling: Tailwind CSS 3.4
UI Components: shadcn/ui inspired
Charts: Recharts 2.12
Icons: Lucide React 0.368
Data Fetching: TanStack React Query 5.36
HTTP Client: Axios
Build Tool: Vite 5.0
```

## 📦 Installation & Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
# or
yarn install
```

### 2. Configure Environment
Create `.env.local`:
```
VITE_API_URL=http://localhost:8000
```

### 3. Start Development Server
```bash
npm run dev
# or
yarn dev
```

Server runs on `http://localhost:5173`

### 4. Build for Production
```bash
npm run build
# or
yarn build
```

Output in `dist/` directory

## 📁 Project Structure

```
src/
├── components/              # React components
│   ├── Dashboard.tsx       # Main dashboard page
│   ├── BalanceCard.tsx     # Currency balance cards
│   ├── WorkerTransactionTable.tsx  # Transaction table
│   ├── ObligationsPanel.tsx        # Obligations view
│   ├── LiquidityHealth.tsx         # Health indicators
│   ├── MetricsPanel.tsx            # Key metrics
│   ├── ActivityFeed.tsx            # Activity timeline
│   ├── Layout.tsx                  # Sidebar & navbar
│   ├── ui.tsx                      # Reusable UI components
│   └── index.ts                    # Component exports
│
├── hooks/                   # Custom React hooks
│   ├── useApi.ts           # API data fetching hooks
│   └── index.ts            # Hook exports
│
├── lib/                     # Utilities & helpers
│   ├── utils.ts            # Formatting & calculations
│   ├── cn.ts               # Classname utility
│   ├── toast.ts            # Toast notifications
│   └── index.ts            # Utility exports
│
├── api.ts                  # API client & types
├── App.tsx                 # Root component
├── main.tsx                # Entry point
└── index.css               # Tailwind + custom styles
```

## 🎨 Styling System

### Color Palette (Dark Mode)
```
Background:      #000000 (pure black)
Card:            #0A0A0A (dark gray)
Border:          #1A1A1A (subtle border)
Text Primary:    #F7F7F7 (off-white)
Text Secondary:  #888888 (muted gray)
Primary:         #3B82F6 (blue)
Secondary:       #10B981 (emerald green)
Accent:          #8B5CF6 (purple)
Destructive:     #EF4444 (red)
```

### Responsive Breakpoints
```
Mobile:   < 640px   (single column)
Tablet:   640-1024px (2-3 columns)
Desktop:  > 1024px  (full layout)
```

## 🔄 Data Fetching

### Auto-Refresh
- **Ledger State**: Every 5 seconds
- **Metrics**: Every 5 seconds
- **Activity Feed**: Mock data (cached)

### React Query
- Automatic caching & deduplication
- Smart invalidation on mutations
- Error handling with retries

```tsx
const { data, isLoading } = useLedgerState();
const metrics = useMetrics();
```

## 📊 API Integration

### Endpoints Used
```
GET  /state           # Ledger state
GET  /metrics         # System metrics
POST /settle/run      # Execute settlement
POST /payout          # Create payout
POST /admin/topup     # Add liquidity
```

### Mock Data
Activity feed uses mock data for demonstration:
```tsx
mockActivityFeed() // 5 sample activities
```

## 🎯 Key Features Implementation

### 1. Real-time Updates
```tsx
// 5-second auto-refresh
const { data } = useLedgerState();
```

### 2. Optimistic UI
```tsx
// Settlement button disables during request
<Button disabled={isSettling}>Run Settlement</Button>
```

### 3. Toast Notifications
```tsx
toast('Settlement executed!', 'success');
```

### 4. Responsive Tables
```tsx
// Mobile-friendly scrolling
<div className="overflow-x-auto">
  <table>...</table>
</div>
```

### 5. Advanced Search & Filter
```tsx
// Search + Filter + Pagination
<input placeholder="Search by account..." />
<select>Filter by status</select>
```

## 🎨 Component Examples

### Balance Card
```tsx
<BalanceCard
  currency="GBP"
  total={500000}  // minor units
  accounts={1}
/>
```

### Obligations Panel
```tsx
<ObligationsPanel
  obligations={obligations}
  grossUsdCents={1250000}
  netUsdCents={250000}
  onSettleClick={handleSettle}
/>
```

### Transaction Table
```tsx
<WorkerTransactionTable
  transactions={transactions}
  accounts={accounts}
  onRowClick={(tx) => console.log(tx)}
/>
```

## 🚀 Performance Optimizations

1. **Code Splitting** - Lazy load components
2. **Image Optimization** - Recharts SVG rendering
3. **Query Caching** - React Query deduplication
4. **CSS Optimization** - Tailwind purging
5. **Bundle Size** - Tree-shaking unused code

## 🔒 Security

- **HTTPS Only** - Production deployment
- **API Authentication** - Add Bearer tokens
- **CORS Headers** - Backend configuration
- **Input Validation** - Pydantic on backend

## 🧪 Testing

### Component Testing
```bash
npm run test
```

### E2E Testing
```bash
npm run test:e2e
```

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Port Already in Use
```bash
npm run dev -- --port 5174
```

### API Connection Issues
Check `VITE_API_URL` in `.env.local`

### Styling Not Applied
- Clear browser cache: Ctrl+Shift+Delete
- Restart dev server

## 📚 Documentation

- [API Reference](../API_DOCUMENTATION.md)
- [Architecture Overview](../README.md)
- [Backend Setup](../QUICKSTART.md)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feat/my-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push to branch: `git push origin feat/my-feature`
4. Create Pull Request

## 📄 License

See [LICENSE](../../LICENSE)

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: February 21, 2026
