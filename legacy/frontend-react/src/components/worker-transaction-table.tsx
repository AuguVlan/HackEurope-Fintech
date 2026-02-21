import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { WorkerTransaction } from "../api";
import { compactId, formatMinor, formatTimestamp, formatUsdCents } from "../lib/format";
import { Badge, Card, Input, Select } from "./ui";

interface WorkerTransactionTableProps {
  rows: WorkerTransaction[];
  onSelect: (row: WorkerTransaction) => void;
}

const PAGE_SIZE = 8;

export function WorkerTransactionTable({
  rows,
  onSelect,
}: WorkerTransactionTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "EXECUTED" | "QUEUED">("ALL");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const statusOk = status === "ALL" ? true : row.status === status;
      const searchOk =
        search.trim().length === 0
          ? true
          : row.worker_id.toLowerCase().includes(search.toLowerCase());
      return statusOk && searchOk;
    });
  }, [rows, search, status]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            Worker Transaction History
          </h2>
          <p className="text-sm text-slate-400">
            Synthetic journal trail across pools
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 md:w-auto">
          <label className="relative min-w-[230px]">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search worker ID"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <Select
            className="min-w-[160px]"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "ALL" | "EXECUTED" | "QUEUED");
              setPage(1);
            }}
          >
            <option value="ALL">All Status</option>
            <option value="EXECUTED">Executed</option>
            <option value="QUEUED">Queued</option>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Worker ID</th>
              <th className="px-3 py-2">From Pool</th>
              <th className="px-3 py-2">To Pool</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">USD Exposure</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Idempotency Key</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-white/10 transition hover:bg-white/5"
                onClick={() => onSelect(row)}
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {formatTimestamp(row.timestamp)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-100">
                  {row.worker_id}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-300">
                  {row.from_pool}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-300">
                  {row.to_pool}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-200">
                  {formatMinor(row.amount_minor, row.currency)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-200">
                  {formatUsdCents(row.usd_exposure_cents)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Badge variant={row.status === "EXECUTED" ? "success" : "warning"}>
                    {row.status}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400">
                  {compactId(row.idempotency_key, 16)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">{row.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <p>
          Showing {visibleRows.length} of {filteredRows.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-white/15 px-3 py-1.5 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Prev
          </button>
          <span className="text-slate-300">
            {safePage} / {pageCount}
          </span>
          <button
            className="rounded-xl border border-white/15 px-3 py-1.5 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}
