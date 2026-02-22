# TideBridge — Cross-Border Settlement Engine

> **HackEurope Fintech 2026** — Real-time BaaS ledger for gig economy platforms with CatBoost-powered credit underwriting

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)

## 🌊 Overview

TideBridge is a Banking-as-a-Service (BaaS) settlement engine designed for taxi and gig economy platforms operating across Germany (EUR) and Turkey (TRY). It provides:

- **Real-time liquidity pools** with automatic FX settlement (EUR ↔ TRY)
- **CatBoost ML underwriting** for advance/credit decisions
- **Risk-based portfolio management** with 4 worker archetypes
- **Single source of truth** data architecture ensuring consistency across all UI components

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| Workers | 500 (250 DE + 250 TR) |
| Active Advances | 120 credit positions |
| FX Rate | 1 EUR = 36.5 TRY |
| Risk Distribution | 35% low, 50% medium, 15% high |
| Compression Ratio | 74% |

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    TideBridge Frontend                       │
│  React 18 + TypeScript + Tailwind + Recharts                │
├──────────────────────────────────────────────────────────────┤
│                     Single Source of Truth                   │
│  mockCreditLog() → mockAccounts() → mockMetrics()           │
│  All UI components derive from cached credit log            │
├──────────────────────────────────────────────────────────────┤
│                      FastAPI Backend                         │
│  /api/ingest • /api/settle • /api/metrics                   │
├──────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│  SQLite + workers_500.csv + fx_transactions.csv             │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Quickstart

### Prerequisites
- Node.js 18+
- Python 3.10+

### Frontend (React Dashboard)

```bash
cd frontend
npm install
npm run build
```

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 📂 Project Structure

```
HackEurope-Fintech/
├── frontend/               # React 18 + Vite dashboard
│   ├── src/
│   │   ├── components/     # Dashboard, CurrencyPools, MetricsPanel, etc.
│   │   ├── lib/            # mockData.ts (single source of truth)
│   │   └── hooks/          # React Query API hooks
│   └── package.json
├── backend/                # FastAPI server (deprecated in mock mode)
├── ingestion/
│   └── data/
│       ├── workers_500.csv       # 500 taxi drivers (DE + TR)
│       └── fx_transactions.csv   # FX settlement history
├── ml/                     # CatBoost model training
└── README.md
```

## 💱 Currency & FX

- **EUR Pool**: German taxi drivers (€15–€55/ride, €300–€800/day)
- **TRY Pool**: Turkish taxi drivers (₺100–₺400/ride, ₺2k–₺8k/day)
- **Live FX Rate**: 36.5 TRY/EUR (Feb 2026)

## 🎯 Risk Archetypes

| Archetype | Weight | Advance Range | PD Range |
|-----------|--------|---------------|----------|
| Rock Solid | 35% | €800–€3,000 | 0.5–3% |
| Good Volatile | 30% | €400–€1,500 | 4–12% |
| Stretched Thin | 20% | €400–€1,500 | 4–12% |
| Red Flags | 15% | €150–€600 | 15–35% |

## 🖥️ Dashboard Features

- **Currency Pools**: EUR/TRY balances with real-time FX chart
- **Risk Distribution**: Pie charts showing portfolio by risk band
- **Transaction History**: Filterable table with EUR/TRY amounts
- **Activity Feed**: Real-time advances and settlements
- **CatBoost Panel**: Credit log, FX settlements, repayments

## 🔧 Development

### Run Tests
```bash
cd frontend && npm test
cd backend && pytest
```

### Build for Production
```bash
cd frontend && npm run build
# Output: frontend/dist/
```

## 📄 License

MIT License — HackEurope Fintech 2026

---

Built by:
- Georg Riekhakainen
- Nicolas Salapete
- Charles Montluc
- Augustin Vlandas
