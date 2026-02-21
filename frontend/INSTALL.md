# Frontend Installation & Development Guide

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure API
Create `.env.local`:
```
VITE_API_URL=http://localhost:8000
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Full Setup Instructions

### Prerequisites
- Node.js 16+ (LTS recommended)
- npm 8+ or yarn 1.22+
- Backend API running on `http://localhost:8000`

### Installation Steps

#### Step 1: Navigate to Frontend Directory
```bash
cd HackEurope-Fintech/frontend
```

#### Step 2: Install npm Dependencies
```bash
npm install
```

This installs:
- React 18.2 (UI framework)
- TypeScript 5.2 (type safety)
- Tailwind CSS 3.4 (styling)
- Recharts 2.12 (charts)
- Lucide Icons (icons)
- TanStack React Query (data fetching)
- Axios (HTTP client)
- Vite (bundler)

**Installation size**: ~500 MB (node_modules)

#### Step 3: Environment Configuration
Create `.env.local` in frontend directory:
```bash
# Copy from example
cp .env.example .env.local
```

Edit `.env.local`:
```
# Required: Backend API endpoint
VITE_API_URL=http://localhost:8000

# Optional: Feature flags
VITE_ENABLE_DEMO_MODE=true
VITE_REFRESH_INTERVAL=5000
```

#### Step 4: Start Development Server
```bash
npm run dev
```

Output:
```
  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

#### Step 5: Open in Browser
Visit [http://localhost:5173](http://localhost:5173)

You should see:
- ✅ Dark mode dashboard
- ✅ Sidebar navigation
- ✅ Currency balance cards
- ✅ Transaction table
- ✅ Obligation panels
- ✅ Metrics displays

## Development Commands

### Start Development Server
```bash
npm run dev
```
- Hot module reloading
- Auto browser refresh
- Source maps for debugging

### Build for Production
```bash
npm run build
```
- Optimizes and minifies code
- Outputs to `dist/` folder
- Ready for deployment

### Preview Production Build
```bash
npm run preview
```
- Serves the production build locally
- Useful for testing before deployment

## Troubleshooting

### Issue: Port 5173 Already in Use
```bash
# Use different port
npm run dev -- --port 5174
```

### Issue: API Connection Errors
**Check 1**: Backend running?
```bash
curl http://localhost:8000/health
# Expected: {"status": "ok", "version": "..."}
```

**Check 2**: Correct API URL in `.env.local`?
```
VITE_API_URL=http://localhost:8000
```

**Check 3**: CORS enabled on backend?
```python
# Should be in FastAPI app:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: Styling Not Applied (Dark Mode)
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Hard refresh: `Ctrl+F5`
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Component Import Errors
Make sure file extensions are `.tsx` for components:
```
✓ src/components/Dashboard.tsx
✗ src/components/Dashboard.ts (wrong)
```

### Issue: Tailwind Classes Not Working
Check postcss.config.js has tailwindcss plugin:
```js
import tailwindcss from 'tailwindcss'

export default {
  plugins: [tailwindcss],
}
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── Layout.tsx       # Sidebar + navbar
│   │   ├── *.tsx           # Feature components
│   │   └── index.ts        # Exports
│   ├── hooks/              # Custom hooks
│   │   ├── useApi.ts      # Data fetching
│   │   └── index.ts       # Exports
│   ├── lib/               # Utilities
│   │   ├── utils.ts       # Helpers
│   │   ├── cn.ts          # Classname util
│   │   ├── toast.ts       # Notifications
│   │   └── index.ts       # Exports
│   ├── api.ts             # API client
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   └── index.css          # Tailwind
│
├── public/                 # Static assets
├── dist/                   # Production build (after build)
├── node_modules/          # Dependencies
│
├── package.json           # npm configuration
├── tsconfig.json          # TypeScript config
├── tailwind.config.ts     # Tailwind config
├── postcss.config.js      # PostCSS config
├── vite.config.ts         # Vite config
├── .env.example           # Example env file
├── .env.local             # Local env (git ignored)
├── README.md              # Component documentation
└── INSTALL.md             # This file
```

## File Size Reference

After installation:
```
node_modules/        ~500 MB (not committed)
dist/ (build)        ~300 KB (minified)
src/                 ~100 KB (source code)
```

## Next Steps

### 1. Understand the Architecture
Read: [Frontend README.md](./README.md)

### 2. Explore Components
```bash
# All components in src/components/
- Dashboard.tsx      (main page)
- Layout.tsx         (sidebar + navbar)
- BalanceCard.tsx    (currency cards)
- WorkerTransactionTable.tsx  (table)
- ObligationsPanel.tsx        (obligations)
- LiquidityHealth.tsx         (health checks)
- MetricsPanel.tsx            (metrics)
- ActivityFeed.tsx            (timeline)
```

### 3. Modify Styling
```bash
# Edit Tailwind CSS
src/index.css

# Custom colors in:
tailwind.config.ts
```

### 4. Add Features
```bash
# Create new component
src/components/MyComponent.tsx

# Create custom hook
src/hooks/useMyHook.ts

# Add utility function
src/lib/utils.ts
```

### 5. Deploy
```bash
# Build for production
npm run build

# Upload dist/ to server
# Configure web server for SPA (index.html fallback)
```

## IDE Setup (VS Code)

### Recommended Extensions
1. **ES7+ React/Redux/React-Native snippets**
   - ID: dsznajder.es7-react-js-snippets

2. **Tailwind CSS IntelliSense**
   - ID: bradlc.vscode-tailwindcss

3. **TypeScript Vue Plugin**
   - ID: Vue.volar

### Settings (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

## Performance Tips

### Development
- Keep dev server running (fast recompilation)
- Use React DevTools browser extension
- Check performance in DevTools > Performance tab

### Production
- Minification: Vite handles automatically
- Code splitting: Dynamic imports for large components
- Image optimization: Use Recharts SVG rendering

## Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Recharts Gallery](https://recharts.org/examples)
- [Lucide Icons](https://lucide.dev)
- [React Query Docs](https://tanstack.com/query)

## Getting Help

### Check Logs
1. Browser Console: `F12 > Console`
2. Terminal where `npm run dev` runs
3. Network tab: Check API responses

### Common Issues
See "Troubleshooting" section above

### Backend Issues
If dashboard loads but shows no data:
1. Check backend is running: `http://localhost:8000/health`
2. Check API URL in `.env.local`
3. Check CORS headers in backend
4. Check `/state` endpoint: `http://localhost:8000/state`

---

**Status**: ✅ Ready to develop
**Last Updated**: February 21, 2026
