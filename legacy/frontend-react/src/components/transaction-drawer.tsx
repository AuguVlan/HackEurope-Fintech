import type { WorkerTransaction } from "../api";
import { formatMinor, formatTimestamp, formatUsdCents } from "../lib/format";
import { Drawer } from "./ui";

interface TransactionDrawerProps {
  transaction: WorkerTransaction | null;
  onClose: () => void;
}

export function TransactionDrawer({ transaction, onClose }: TransactionDrawerProps) {
  const open = Boolean(transaction);

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Journal Entry Detail"
      description={transaction ? `Worker ${transaction.worker_id}` : undefined}
    >
      {transaction ? (
        <dl className="grid grid-cols-1 gap-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase text-slate-500">Timestamp</dt>
            <dd className="mt-1 text-slate-100">{formatTimestamp(transaction.timestamp)}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase text-slate-500">Worker</dt>
            <dd className="mt-1 font-mono text-slate-100">{transaction.worker_id}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase text-slate-500">Path</dt>
            <dd className="mt-1 text-slate-100">
              {transaction.from_pool} → {transaction.to_pool}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase text-slate-500">Amount / Exposure</dt>
            <dd className="mt-1 text-slate-100">
              {formatMinor(transaction.amount_minor, transaction.currency)} /{" "}
              {formatUsdCents(transaction.usd_exposure_cents)}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase text-slate-500">Idempotency Key</dt>
            <dd className="mt-1 font-mono text-xs text-slate-200">
              {transaction.idempotency_key}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase text-slate-500">Raw Journal Entry</dt>
            <dd className="mt-1 overflow-auto rounded-xl bg-black/35 p-3 font-mono text-xs text-slate-200">
              <pre>{JSON.stringify(transaction.journal_entry, null, 2)}</pre>
            </dd>
          </div>
        </dl>
      ) : null}
    </Drawer>
  );
}
