import { CheckCircle2, Clock3, FileStack, Landmark, TrendingUp } from "lucide-react";
import { Card } from "./ui";
import { formatTimestamp } from "../lib/format";

export type ActivityType =
  | "payout_executed"
  | "payout_queued"
  | "settlement_batch_created"
  | "liquidity_topup";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  at: number;
  description: string;
}

function iconFor(type: ActivityType) {
  if (type === "payout_executed") return CheckCircle2;
  if (type === "payout_queued") return Clock3;
  if (type === "settlement_batch_created") return FileStack;
  return TrendingUp;
}

function tintFor(type: ActivityType): string {
  if (type === "payout_executed") return "text-emerald-300";
  if (type === "payout_queued") return "text-amber-300";
  if (type === "settlement_batch_created") return "text-cyan-300";
  return "text-indigo-300";
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Activity Feed</h2>
          <p className="text-sm text-slate-400">Latest ledger events</p>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = iconFor(item.type);
          return (
            <li
              key={item.id}
              className="rounded-2xl border border-white/10 bg-slate-900/45 px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 ${tintFor(item.type)}`} />
                <div>
                  <p className="text-sm text-slate-200">{item.description}</p>
                  <p className="text-xs text-slate-500">{formatTimestamp(item.at)}</p>
                </div>
              </div>
            </li>
          );
        })}
        {items.length === 0 ? (
          <li className="rounded-2xl border border-white/10 bg-slate-900/45 px-3 py-2 text-sm text-slate-400">
            No activity events yet.
          </li>
        ) : null}
      </ul>
    </Card>
  );
}
