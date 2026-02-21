# Dashboard Feature Documentation

## Overview

Production-grade financial infrastructure dashboard with real-time data visualization, advanced filtering, and settlement management for the Synthetic Liquidity Cross-Border Ledger system.

## Features Breakdown

### 1. Multi-Currency Balance Overview

**Location**: Top of dashboard (3-column grid on desktop, responsive on mobile)

**Components**:
- GBP Balance Card
- BRL Balance Card  
- EUR Balance Card (if available)
- USD Exposure (calculated)

**Each Card Shows**:
```
┌─────────────────────────────────┐
│ Total GBP                       │
│ £50,000.00              📈 +2.5%│
│                                 │
│ ▁▂▃▄▅▆▇█▆▅▄▃▂ (Sparkline)     │
│                                 │
│ 1 pool | 2.5% change this month │
└─────────────────────────────────┘
```

**Features**:
- Real-time balance aggregation
- Sparkline trend chart (12-point historical)
- Monthly percentage change
- Pool count for each currency
- Color-coded trend indicators (green/red)

**Data Source**: `GET /state` → aggregate by currency

---

### 2. Transaction History Table

**Location**: Main content area below balance cards

**Features**:

#### Search
- Real-time search by account ID
- Case-insensitive matching
- Instant filtering

#### Filtering
- Status: EXECUTED, QUEUED, PENDING
- Type: Obligation, Payout, Settlement, Topup
- Multi-select capable

#### Pagination
- 10 items per page
- Next/Previous buttons
- Page number selector (1, 2, 3...)
- Total count display

#### Columns
| Column | Details |
|--------|---------|
| Timestamp | Formatted date/time |
| From Account | Source pool ID (mono font) |
| To Account | Destination pool ID (mono font) |
| Amount | Formatted currency (£, ₽, €) |
| USD Exposure | Converted to USD cents |
| Status | Badge (green/yellow/blue) |
| Type | Transaction type |
| Idempotency Key | UUID first 8 chars |

#### Row Actions
- Click row → Side drawer with full details
- Hover → Highlight background
- Sortable columns (click header)

**Data Source**: `GET /state` → format obligations as transactions

---

### 3. Open Obligations Panel

**Location**: Left column below balance cards

**Display**:
```
┌──────────────────────────────────┐
│ Open Obligations                 │
│ Settlement exposure across pools  │
│                                   │
│ Gross:     $125,000.00           │
│ Net:       $25,000.00            │
│ Compress:  80%                   │
│                                   │
│ Top Pool Pairs:                  │
│ • UK_GBP ↔ BR_BRL   $75,000.00  │
│ • UK_GBP ↔ EU_EUR   $30,000.00  │
│ • BR_BRL ↔ EU_EUR   $20,000.00  │
│                                   │
│ [Run Settlement] (secondary btn)  │
└──────────────────────────────────┘
```

**Key Metrics**:
- **Gross Exposure**: Sum of all open obligations
- **Net Exposure**: Position after bilateral netting
- **Compression Ratio**: (Gross - Net) / Gross × 100%

**Status Indicator**:
- ✓ Green: Healthy (net < gross × 20%)
- ⚠ Red: Large exposure (net > gross × 20%)

**Top Pool Pairs**:
- Lists top 5 pairs by USD exposure
- Shows pool IDs with bidirectional arrow
- Color-coded USD badge

**Settlement Button**:
- Calls `POST /settle/run`
- Disabled while settling
- Shows loading state
- Toast notification on success/error

**Data Source**: `GET /state` → obligations array

---

### 4. Liquidity Health Panel

**Location**: Left column, below obligations

**Display**:
```
┌──────────────────────────────────┐
│ Liquidity Health                 │
│ Buffer utilization by pool       │
│                                   │
│ ✓ POOL_UK_GBP         Healthy   │
│   £50,000 / £1,000 buffer        │
│   ████████████░░░░░  500% (5x)   │
│                                   │
│ ⚠ POOL_BR_BRL         Warning   │
│   ₽100,000 / ₽50,000 buffer      │
│   ██████░░░░░░░░░░░░  200% (2x)  │
│                                   │
│ ✗ POOL_EU_EUR         Critical  │
│   €5,000 / €10,000 buffer        │
│   ███░░░░░░░░░░░░░░░░   50% (0.5x)
└──────────────────────────────────┘
```

**For Each Pool**:
1. **Status Badge**
   - Green: ≥5x buffer (healthy)
   - Yellow: 2-5x buffer (warning)
   - Red: <2x buffer (critical)

2. **Visual Progress Bar**
   - Height indicates ratio
   - Color matches status
   - Smooth animation on update

3. **Details**
   - Current balance (formatted currency)
   - Min buffer requirement
   - Ratio multiplier (x)

4. **Sorting**
   - Ordered by risk (lowest ratio first)
   - Critical pools at top

**Data Source**: `GET /state` → accounts array

---

### 5. Key Metrics Panel

**Location**: Right column

**Sections**:

#### Gross & Net Exposure
```
Gross Exposure: $125,000.00
Net Exposure:   $25,000.00
```

#### Settlement Compression (Radial Chart)
```
     80% 
   Compression
   ╭─────────╮
   │    20%  │ (Net)
   │   ░░░░░ │
   │░░░░░░░░░│ (Saved)
   ╰─────────╯
```

- Inner pie shows compression
- Percentage in center
- Green = efficiency

#### Queued Payouts
- Count of items in `payout_queue`
- Status badge

#### Transactions Today
- Daily transaction volume
- From metrics endpoint

**Data Source**: `GET /metrics`

---

### 6. Activity Feed

**Location**: Right column below metrics

**Format**:
```
┌──────────────────────────────────┐
│ Activity Feed                    │
│ Recent ledger events             │
│                                   │
│ 🔵 Payout executed               │
│   Payout to POOL_BR_BRL         │
│   14:32 UTC                      │
│                                   │
│ 🟣 Obligation created            │
│   £10,000.00 transaction         │
│   14:28 UTC                      │
│                                   │
│ 🟢 Settlement batch complete    │
│   3 settlements processed        │
│ 14:22 UTC                        │
└──────────────────────────────────┘
```

**Activity Types**:
- 🔵 **Payout Executed** (Send icon, blue)
- 🟠 **Payout Queued** (Clock icon, yellow)
- 🟣 **Obligation Created** (File icon, purple)
- 🟢 **Settlement Batch** (Check icon, green)
- 🟡 **Liquidity Top-up** (Trending Up icon, yellow)

**Features**:
- Chronological order (newest first)
- Formatted timestamps
- Color-coded by type
- Gradient background per type

**Data Source**: Mock data (future: webhook events)

---

### 7. Navigation

#### Sidebar
```
┌────────────────────┐
│ ⚡ Ledger          │
│ Synthetic Liquidity │
├────────────────────┤
│ 📊 Dashboard       │ (active)
│ 📖 Ledger          │
│ 👥 Workers         │
│ 📄 Obligations     │
│ ⚡ Settlement      │
│ 📈 Metrics         │
├────────────────────┤
│                    │
│  [Sign Out]        │
└────────────────────┘
```

**Features**:
- Logo + name at top
- 6 main navigation items
- Active state highlighting
- Sign out button at bottom
- Collapses on mobile
- Smooth slide-in animation

#### Top Navbar
```
┌────────────────────────────────────────┐
│ ☰ Admin Dashboard               🟢 DEV │
│   Synthetic Liquidity Settlement   👤 │
└────────────────────────────────────────┘
```

**Elements**:
- Menu toggle (mobile)
- Page title
- Environment badge (DEV in development)
- User avatar + name

---

## Real-time Behavior

### Auto-Refresh
- **Ledger State**: Every 5 seconds
- **Metrics**: Every 5 seconds
- **Activity Feed**: Manual refresh only

### Optimistic Updates
- Settlement button disables immediately
- Toast shows "Settling..."
- Auto-refetch on success

### Error Handling
- Network errors show toast
- Automatic retry with backoff
- Graceful degradation (shows last data)

---

## Responsive Design

### Mobile (< 640px)
- Single column layout
- Sidebar slides in from left
- Full-width tables with horizontal scroll
- Stacked cards

### Tablet (640-1024px)
- 2-column layout
- Sidebar visible at top
- Tables fit better

### Desktop (> 1024px)
- Full sidebar navigation
- 3-column grid layout
- All features visible

---

## Color Scheme

### Status Badges
- ✓ **Success/Healthy**: `#10B981` (emerald)
- ⚠ **Warning**: `#F59E0B` (amber)
- ✗ **Critical/Error**: `#EF4444` (red)
- ℹ **Info**: `#3B82F6` (blue)

### Cards
- Background: `#0A0A0A` (dark gray)
- Border: `#1A1A1A` (subtle border)
- Glass effect: 50% opacity with blur

### Text
- Primary: `#F7F7F7` (off-white)
- Secondary: `#888888` (muted gray)

---

## Performance

### Metrics
- Page load: < 2s
- First interaction: < 1s
- Auto-refresh: < 500ms

### Optimization
- React Query caching
- Recharts SVG rendering
- CSS-in-JS optimization
- Code splitting by route

---

## Future Enhancements

1. **WebSocket Support**
   - Real-time updates via WebSocket
   - Remove 5-second polling
   - Sub-100ms latency

2. **Export Features**
   - Export transactions to CSV
   - PDF reports
   - Scheduled exports

3. **Advanced Analytics**
   - Historical charts
   - Settlement patterns
   - Cost analysis

4. **User Management**
   - Role-based access
   - Audit logs
   - API keys

5. **Alerts & Rules**
   - Custom thresholds
   - Email notifications
   - Slack integration

---

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: February 21, 2026
