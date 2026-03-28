"use client";

import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";

type TradeStatus = "all" | "active" | "pending" | "completed" | "disputed";

const FILTERS: { label: string; value: TradeStatus }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Disputed", value: "disputed" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "text-status-success bg-emerald-muted",
  pending: "text-status-warning bg-yellow-500/10",
  completed: "text-text-secondary bg-bg-elevated",
  disputed: "text-status-danger bg-red-500/10",
  locked: "text-status-locked bg-gold-muted",
};

// Mock trades — replace with Supabase/Soroban fetch
const MOCK_TRADES = [
  {
    id: "TRD-001",
    counterparty: "0xA1b2...C3d4",
    asset: "XLM / USDC",
    amount: "2,500 USDC",
    status: "active",
    created: "Mar 20, 2026",
  },
  {
    id: "TRD-002",
    counterparty: "0xE5f6...G7h8",
    asset: "XLM / USDC",
    amount: "800 USDC",
    status: "pending",
    created: "Mar 19, 2026",
  },
  {
    id: "TRD-003",
    counterparty: "0xI9j0...K1l2",
    asset: "BTC / USDC",
    amount: "12,000 USDC",
    status: "completed",
    created: "Mar 15, 2026",
  },
  {
    id: "TRD-004",
    counterparty: "0xM3n4...O5p6",
    asset: "ETH / USDC",
    amount: "3,200 USDC",
    status: "disputed",
    created: "Mar 10, 2026",
  },
];

const PAGE_SIZE = 10;

export default function TradesPage() {
  const [activeFilter, setActiveFilter] = useState<TradeStatus>("all");
  const [page, setPage] = useState(1);

  const filtered =
    activeFilter === "all"
      ? MOCK_TRADES
      : MOCK_TRADES.filter((t) => t.status === activeFilter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilter(value: TradeStatus) {
    setActiveFilter(value);
    setPage(1);
  }

  return (
    <Shell>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Trades</h1>
        <Link
          href="/trades/new"
          className="px-4 py-2 rounded-md bg-gold text-text-inverse text-sm font-medium hover:bg-gold-hover transition-colors"
        >
          Create Trade
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border-default pb-[1px] mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            className={`pb-3 px-1 text-sm transition-colors ${
              activeFilter === f.value
                ? "text-gold underline underline-offset-8 decoration-gold decoration-2"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Trade list */}
      {paginated.length === 0 ? (
        <p className="text-text-muted text-sm py-12 text-center">
          No trades found.
        </p>
      ) : (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-bg-card">
                <th className="text-left px-4 py-3 text-text-muted font-medium">ID</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Counterparty</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Asset</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((trade, i) => (
                <tr
                  key={trade.id}
                  className={`border-b border-border-default last:border-0 hover:bg-bg-elevated transition-colors ${
                    i % 2 === 0 ? "bg-bg-primary" : "bg-bg-card"
                  }`}
                >
                  <td className="px-4 py-3 text-gold font-mono">
                    <Link href={`/trades/${trade.id}`} className="hover:underline underline-offset-4">
                      {trade.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono">{trade.counterparty}</td>
                  <td className="px-4 py-3 text-text-primary">{trade.asset}</td>
                  <td className="px-4 py-3 text-text-primary">{trade.amount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[trade.status] ?? "text-text-muted"
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{trade.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-text-secondary">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border border-border-default hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border border-border-default hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
