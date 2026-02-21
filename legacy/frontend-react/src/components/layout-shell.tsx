import { useState, type PropsWithChildren } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bolt,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from "lucide-react";
import { cn } from "../lib/cn";
import { Badge } from "./ui";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Ledger", icon: BookOpen },
  { label: "Workers", icon: Users },
  { label: "Obligations", icon: Activity },
  { label: "Settlement", icon: Bolt },
  { label: "Metrics", icon: BarChart3 },
];

function SidebarContent() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-500 to-indigo-500 shadow-lg shadow-cyan-900/35">
          <Bolt className="h-5 w-5 text-slate-950" />
        </div>
        <div>
          <p className="text-xl font-semibold text-slate-100">Ledger</p>
          <p className="text-xs text-slate-400">Synthetic Liquidity</p>
        </div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.label === "Dashboard";
          return (
            <button
              key={item.label}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/35"
                  : "text-slate-300 hover:bg-white/5 hover:text-slate-100",
              )}
              type="button"
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        System control in read mode
      </div>
    </div>
  );
}

export function LayoutShell({ children }: PropsWithChildren) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <div className="flex">
        <aside className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-slate-950/65 backdrop-blur-xl lg:block">
          <SidebarContent />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden">
            <aside className="h-full w-72 border-r border-white/10 bg-slate-950/95">
              <div className="flex justify-end p-3">
                <button
                  className="rounded-xl p-2 text-slate-300 hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent />
            </aside>
          </div>
        ) : null}

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/50 px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10 lg:hidden"
                  type="button"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-slate-100 md:text-2xl">
                    Synthetic Liquidity Dashboard
                  </h1>
                  <p className="text-xs text-slate-400 md:text-sm">
                    Cross-border ledger control plane
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="success" className="hidden md:inline-flex">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  System Healthy
                </Badge>
                <Badge variant="info">DEV</Badge>
              </div>
            </div>
          </header>
          <div className="flex-1 px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
