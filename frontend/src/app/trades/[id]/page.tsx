"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";

type CardData = {
  title: string;
  value: string;
  helper: string;
};

const cardPromiseCache = new Map<string, Promise<CardData>>();

function buildEscrowAddress(tradeId: string) {
  return `ESCROW_${tradeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "UNKNOWN"}`;
}

function getCardPromise(tradeId: string, key: "status" | "asset" | "counterparty") {
  const cacheKey = `${tradeId}:${key}`;
  const cached = cardPromiseCache.get(cacheKey);
  if (cached) return cached;

  const promise = new Promise<CardData>((resolve) => {
    const delay = key === "status" ? 450 : key === "asset" ? 700 : 1000;
    setTimeout(() => {
      if (key === "status") {
        resolve({
          title: "Trade Status",
          value: "active",
          helper: "Synced from escrow contract state",
        });
        return;
      }
      if (key === "asset") {
        resolve({
          title: "Asset Pair",
          value: "XLM / USDC",
          helper: "Current pair attached to trade",
        });
        return;
      }
      resolve({
        title: "Counterparty",
        value: "0xA1b2...C3d4",
        helper: "Wallet currently bound to escrow",
      });
    }, delay);
  });

  cardPromiseCache.set(cacheKey, promise);
  return promise;
}

function BentoCard({
  tradeId,
  cardKey,
}: {
  tradeId: string;
  cardKey: "status" | "asset" | "counterparty";
}) {
  const data = use(getCardPromise(tradeId, cardKey));

  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{data.title}</p>
      <p className="mt-3 text-lg font-semibold text-text-primary">{data.value}</p>
      <p className="mt-2 text-xs text-text-secondary">{data.helper}</p>
    </div>
  );
}

function BentoFallback({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-4 animate-pulse">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-3 h-6 w-2/3 rounded bg-bg-elevated" />
      <div className="mt-2 h-4 w-full rounded bg-bg-elevated" />
    </div>
  );
}

function TradeDetailOrganism({ tradeId }: { tradeId: string }) {
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setEscrowAddress(buildEscrowAddress(tradeId));
    }, 500);

    return () => clearTimeout(timeout);
  }, [tradeId]);

  const createdAt = useMemo(() => new Date().toLocaleString(), []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-default bg-bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Trade ID</p>
        <p className="mt-2 text-xl font-semibold text-text-primary font-mono">{tradeId}</p>
        <p className="mt-3 text-sm text-text-secondary">
          Escrow Contract:{" "}
          {!escrowAddress ? (
            <span className="text-text-muted">resolving on-chain...</span>
          ) : (
            <span className="font-mono text-gold">{escrowAddress}</span>
          )}
        </p>
        <p className="mt-2 text-xs text-text-muted">Loaded: {createdAt}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Suspense fallback={<BentoFallback label="Trade Status" />}>
          <BentoCard tradeId={tradeId} cardKey="status" />
        </Suspense>
        <Suspense fallback={<BentoFallback label="Asset Pair" />}>
          <BentoCard tradeId={tradeId} cardKey="asset" />
        </Suspense>
        <Suspense fallback={<BentoFallback label="Counterparty" />}>
          <BentoCard tradeId={tradeId} cardKey="counterparty" />
        </Suspense>
      </div>
    </div>
  );
}

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tradeId = params?.id ?? "UNKNOWN";

  return (
    <Shell
      topBarAction={
        <button
          onClick={() => router.push("/trades")}
          className="px-3 py-1.5 rounded-md border border-border-default hover:border-border-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          Back to Trades
        </button>
      }
    >
      <TradeDetailOrganism key={tradeId} tradeId={tradeId} />
    </Shell>
  );
}
