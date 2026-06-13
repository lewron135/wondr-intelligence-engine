"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ComposedChart,
  AreaChart,
  BarChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Info,
  Layers,
  Wallet,
  PlusCircle,
  Trash2,
  Pencil,
  Save,
  X,
} from "lucide-react";

import { WATCHLIST } from "@/constants/watchlist";
import { calcSMA, calcRSI, calcMACD } from "@/lib/market/indicators";
import { generateAnalysis } from "@/lib/market/scoring";
import type {
  ChartData,
  StockMeta,
  Analysis,
  RecommendationLevel,
  PortfolioHolding,
} from "@/types/market";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USER_ID = "usr_123";

// ─── Utilities ─────────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtPrice(price: number, currency: string): string {
  if (currency === "IDR") {
    return price.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtVol(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return vol.toString();
}

function recColors(rec: RecommendationLevel): string {
  switch (rec) {
    case "STRONG BUY":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "BUY":
      return "bg-green-100 text-green-800 border-green-200";
    case "HOLD":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "REDUCE":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "AVOID":
      return "bg-red-100 text-red-800 border-red-200";
    case "AVERAGE DOWN":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "TAKE PROFIT":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "CUT LOSS":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "HOLD (No Buying Power)":
      return "bg-amber-100 text-amber-700 border-amber-200";
  }
}

function rsiBadge(rsi: number | null): string {
  if (rsi === null) return "bg-gray-100 text-gray-500";
  if (rsi < 35) return "bg-emerald-100 text-emerald-700 font-bold";
  if (rsi > 65) return "bg-red-100 text-red-700 font-bold";
  return "bg-gray-100 text-gray-600";
}

// ─── Yahoo Finance parser ───────────────────────────────────────────────────

function parseYahoo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
): { meta: StockMeta; chartData: ChartData[] } | null {
  try {
    const result = raw?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const m = result.meta ?? {};

    const rawClose: (number | null)[] = quote.close ?? [];
    const closes = rawClose.map((c) => c ?? 0);

    const ma20 = calcSMA(closes, 20);
    const ma50 = calcSMA(closes, 50);
    const ma200 = calcSMA(closes, 200);
    const rsiArr = calcRSI(closes);
    const { macdLine, macdSignal, macdHist } = calcMACD(closes);

    const chartData: ChartData[] = timestamps.map((ts, i) => ({
      timestamp: ts,
      label: fmtDate(ts),
      open: (quote.open?.[i] as number) ?? 0,
      high: (quote.high?.[i] as number) ?? 0,
      low: (quote.low?.[i] as number) ?? 0,
      close: closes[i],
      volume: (quote.volume?.[i] as number) ?? 0,
      ma20: ma20[i],
      ma50: ma50[i],
      ma200: ma200[i],
      rsi: rsiArr[i],
      macdHist: macdHist[i],
      macdLine: macdLine[i],
      macdSignal: macdSignal[i],
    }));

    const prevClose: number =
      m.previousClose ?? m.chartPreviousClose ?? m.regularMarketPrice ?? 0;
    const price: number = m.regularMarketPrice ?? 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const meta: StockMeta = {
      symbol: m.symbol ?? "",
      currency: m.currency ?? "USD",
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePct,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? 0,
      regularMarketVolume: m.regularMarketVolume ?? 0,
    };

    return { meta, chartData };
  } catch {
    return null;
  }
}

// ─── State types ────────────────────────────────────────────────────────────

interface RowData {
  symbol: string;
  name: string;
  region: "ID" | "US";
  meta: StockMeta | null;
  chartData: ChartData[];
  rsi: number | null;
  analysis: Analysis | null;
  loading: boolean;
  error: boolean;
}

interface PortfolioState {
  cashBalance: number;
  holdings: PortfolioHolding[];
}

// ─── Shared UI pieces ──────────────────────────────────────────────────────

function RecBadge({ rec }: { rec: RecommendationLevel }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border tracking-tight whitespace-nowrap ${recColors(rec)}`}
    >
      {rec}
    </span>
  );
}

function SignalIcon({ type }: { type: "bullish" | "bearish" | "neutral" }) {
  if (type === "bullish")
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (type === "bearish")
    return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  return <MinusCircle className="w-4 h-4 text-gray-400 shrink-0" />;
}

// ─── Tab 1: Watchlist ──────────────────────────────────────────────────────

function WatchlistTab({
  rows,
  onViewChart,
}: {
  rows: RowData[];
  onViewChart: (symbol: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["Symbol", "Company", "Price", "1D Change", "RSI(14)", "Signal", ""].map(
                (h) => (
                  <th
                    key={h}
                    className={`px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                      h === "Price" || h === "1D Change"
                        ? "text-right"
                        : h === "RSI(14)" || h === "Signal"
                        ? "text-center"
                        : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr
                key={row.symbol}
                className="hover:bg-indigo-50/30 transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900">
                      {row.symbol}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        row.region === "ID"
                          ? "bg-red-50 text-red-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {row.region}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-500 text-xs max-w-[180px] truncate">
                  {row.name}
                </td>
                <td className="px-5 py-4 text-right">
                  {row.loading ? (
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-20 ml-auto" />
                  ) : row.error || !row.meta ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <span className="font-mono font-semibold text-gray-900">
                      {row.meta.currency === "USD" ? "$" : ""}
                      {fmtPrice(row.meta.regularMarketPrice, row.meta.currency)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  {row.loading ? (
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-14 ml-auto" />
                  ) : row.error || !row.meta ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <span
                      className={`flex items-center justify-end gap-1 font-semibold text-sm ${
                        row.meta.regularMarketChangePercent >= 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {row.meta.regularMarketChangePercent >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {row.meta.regularMarketChangePercent >= 0 ? "+" : ""}
                      {row.meta.regularMarketChangePercent.toFixed(2)}%
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  {row.loading ? (
                    <div className="h-5 bg-gray-100 rounded-full animate-pulse w-10 mx-auto" />
                  ) : row.rsi !== null ? (
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs ${rsiBadge(row.rsi)}`}
                    >
                      {row.rsi.toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  {row.loading ? (
                    <div className="h-5 bg-gray-100 rounded-full animate-pulse w-20 mx-auto" />
                  ) : row.analysis ? (
                    <RecBadge rec={row.analysis.recommendation} />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    onClick={() => onViewChart(row.symbol)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <Activity className="w-3 h-3" />
                    Chart
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">
        Data via Yahoo Finance · FastAPI cache 60s · IDR prices in Rupiah
      </p>
    </div>
  );
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────

function PriceTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) =>
          p.value != null && (
            <div key={p.dataKey} className="flex justify-between gap-3">
              <span style={{ color: p.color }} className="truncate">
                {p.name}
              </span>
              <span className="font-mono font-semibold text-gray-900 ml-auto">
                {typeof p.value === "number" ? fmtPrice(p.value, currency) : "—"}
              </span>
            </div>
          )
      )}
    </div>
  );
}

// ─── Scorecard ─────────────────────────────────────────────────────────────

function ScoreCard({
  analysis,
  meta,
}: {
  analysis: Analysis;
  meta: StockMeta;
}) {
  const scoreColor =
    analysis.score >= 4
      ? "text-emerald-600"
      : analysis.score >= 0
      ? "text-amber-600"
      : "text-red-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Analysis Score
          </p>
          <span className={`text-5xl font-black leading-none ${scoreColor}`}>
            {analysis.score > 0 ? "+" : ""}
            {analysis.score}
          </span>
          <span className="text-sm text-gray-400 ml-1">/ max 10</span>
        </div>
        <div className="text-right">
          <RecBadge rec={analysis.recommendation} />
          <p className="text-[10px] text-gray-400 mt-2">Outlook</p>
        </div>
      </div>

      {meta.fiftyTwoWeekHigh > 0 && meta.fiftyTwoWeekLow > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
            <span>52W Low: {fmtPrice(meta.fiftyTwoWeekLow, meta.currency)}</span>
            <span>52W High: {fmtPrice(meta.fiftyTwoWeekHigh, meta.currency)}</span>
          </div>
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 w-full" />
            {(() => {
              const range = meta.fiftyTwoWeekHigh - meta.fiftyTwoWeekLow;
              const pct =
                range > 0
                  ? ((meta.regularMarketPrice - meta.fiftyTwoWeekLow) / range) * 100
                  : 50;
              return (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow"
                  style={{ left: `${Math.min(Math.max(pct, 4), 96)}%` }}
                />
              );
            })()}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Signals
        </p>
        {analysis.signals.map((sig, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-xl border ${
              sig.type === "bullish"
                ? "bg-emerald-50 border-emerald-100"
                : sig.type === "bearish"
                ? "bg-red-50 border-red-100"
                : "bg-gray-50 border-gray-100"
            }`}
          >
            <SignalIcon type={sig.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-gray-900">{sig.label}</span>
                <span
                  className={`text-[10px] font-bold ${
                    sig.score > 0
                      ? "text-emerald-600"
                      : sig.score < 0
                      ? "text-red-500"
                      : "text-gray-400"
                  }`}
                >
                  {sig.score > 0 ? `+${sig.score}` : sig.score || ""}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {sig.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2: Chart View ─────────────────────────────────────────────────────

const RANGES = [
  { label: "1M", value: "1mo", interval: "1d" },
  { label: "3M", value: "3mo", interval: "1d" },
  { label: "6M", value: "6mo", interval: "1d" },
  { label: "1Y", value: "1y", interval: "1wk" },
  { label: "2Y", value: "2y", interval: "1wk" },
];

function ChartTab({
  rows,
  selectedSymbol,
  onSelectSymbol,
  chartData,
  meta,
  analysis,
  chartRange,
  onRangeChange,
  loading,
}: {
  rows: RowData[];
  selectedSymbol: string;
  onSelectSymbol: (s: string) => void;
  chartData: ChartData[];
  meta: StockMeta | null;
  analysis: Analysis | null;
  chartRange: string;
  onRangeChange: (r: string) => void;
  loading: boolean;
}) {
  const currency = meta?.currency ?? "USD";
  const tickEvery = Math.max(1, Math.floor(chartData.length / 7));
  const priceFmt = (v: number) => fmtPrice(v, currency);

  const macdCells = chartData.map((d, i) => (
    <Cell
      key={i}
      fill={(d.macdHist ?? 0) >= 0 ? "#10b981" : "#ef4444"}
      fillOpacity={0.8}
    />
  ));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {rows.map((row) => (
              <button
                key={row.symbol}
                onClick={() => onSelectSymbol(row.symbol)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  row.symbol === selectedSymbol
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {row.symbol}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => onRangeChange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  chartRange === r.value
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {meta && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap">
            <div>
              <span className="font-mono font-black text-gray-900 text-lg">
                {meta.currency === "USD" ? "$" : ""}
                {fmtPrice(meta.regularMarketPrice, meta.currency)}
              </span>
              <span
                className={`ml-2 text-sm font-semibold ${
                  meta.regularMarketChangePercent >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {meta.regularMarketChangePercent >= 0 ? "+" : ""}
                {meta.regularMarketChangePercent.toFixed(2)}%
              </span>
            </div>
            <span className="text-xs text-gray-400">Vol: {fmtVol(meta.regularMarketVolume)}</span>
            <span className="text-xs text-gray-400">Currency: {meta.currency}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading market data…</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <p className="text-sm text-gray-400">
            No data — backend or Yahoo Finance may be unavailable.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-0 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
                Price &amp; Moving Averages
              </span>
            </div>
            <div className="px-2 pt-2">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} syncId="market" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={tickEvery} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={priceFmt} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={72} domain={["auto", "auto"]} />
                  <Tooltip content={<PriceTooltip currency={currency} />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  <Area type="monotone" dataKey="close" name="Close" stroke="#6366f1" fill="url(#priceGrad)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#6366f1" }} />
                  <Line type="monotone" dataKey="ma20" name="MA20" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="ma50" name="MA50" stroke="#8b5cf6" strokeWidth={1.5} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="ma200" name="MA200" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="px-5 pt-3 pb-0">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">RSI (14)</span>
            </div>
            <div className="px-2 pt-1">
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} syncId="market" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={tickEvery} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [typeof v === "number" ? v.toFixed(1) : v, "RSI"]}
                    labelFormatter={(l) => l}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
                  <Area type="monotone" dataKey="rsi" name="RSI" stroke="#6366f1" fill="url(#rsiGrad)" strokeWidth={1.5} dot={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="px-5 pt-3 pb-0">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">MACD (12, 26, 9)</span>
            </div>
            <div className="px-2 pt-1">
              <ResponsiveContainer width="100%" height={130}>
                <ComposedChart data={chartData} syncId="market" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={tickEvery} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(0)} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, n: any) => [typeof v === "number" ? v.toFixed(4) : v, n]}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
                  <Bar dataKey="macdHist" name="Histogram" maxBarSize={6}>{macdCells}</Bar>
                  <Line type="monotone" dataKey="macdLine" name="MACD" stroke="#6366f1" strokeWidth={1.5} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="macdSignal" name="Signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="px-5 pt-3 pb-0">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Volume</span>
            </div>
            <div className="px-2 pt-1 pb-4">
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={chartData} syncId="market" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={tickEvery} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtVol} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [typeof v === "number" ? fmtVol(v) : v, "Volume"]}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="volume" name="Volume" fill="#c7d2fe" maxBarSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {analysis && meta && <ScoreCard analysis={analysis} meta={meta} />}
        </>
      )}
    </div>
  );
}

// ─── Tab 3: Recommendations ────────────────────────────────────────────────

function RecommendationsTab({ rows }: { rows: RowData[] }) {
  const loaded = rows.filter((r) => !r.loading && !r.error && r.analysis);
  const longBuys = loaded.filter(
    (r) => r.analysis!.recommendation === "STRONG BUY" || r.analysis!.recommendation === "BUY"
  );
  const shortOpp = loaded.filter(
    (r) => r.analysis!.recommendation === "HOLD" && r.analysis!.score > 0
  );
  const avoidNow = loaded.filter(
    (r) => r.analysis!.recommendation === "REDUCE" || r.analysis!.recommendation === "AVOID"
  );
  const pending = rows.filter((r) => r.loading).length;

  function RecRow({ row }: { row: RowData }) {
    const sig = row.analysis!.signals[0];
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-100 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono font-bold text-gray-900 text-sm">{row.symbol}</span>
            <RecBadge rec={row.analysis!.recommendation} />
            <span className={`ml-auto text-sm font-black ${row.analysis!.score > 0 ? "text-emerald-600" : row.analysis!.score < 0 ? "text-red-500" : "text-gray-400"}`}>
              {row.analysis!.score > 0 ? "+" : ""}
              {row.analysis!.score}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1">{row.name}</p>
          {sig && (
            <div className="flex items-center gap-1.5">
              <SignalIcon type={sig.type} />
              <span className="text-[11px] text-gray-500">{sig.label}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  function Section({ title, icon, items, emptyMsg, accent }: {
    title: string; icon: React.ReactNode; items: RowData[];
    emptyMsg: string; accent: string;
  }) {
    return (
      <div className="space-y-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${accent}`}>
          {icon}
          <span className="text-sm font-bold">{title}</span>
          <span className="ml-auto text-xs font-semibold opacity-70">
            {items.length} stock{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 px-4">{emptyMsg}</p>
        ) : (
          <div className="space-y-2">{items.map((r) => <RecRow key={r.symbol} row={r} />)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pending > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="text-xs text-indigo-700">Loading {pending} symbol{pending !== 1 ? "s" : ""}…</span>
        </div>
      )}
      <Section title="Long-Term Buys" icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} items={longBuys} emptyMsg="No strong buy signals at this time." accent="bg-emerald-50 text-emerald-800" />
      <Section title="Short-Term Opportunities" icon={<Activity className="w-4 h-4 text-amber-600" />} items={shortOpp} emptyMsg="No short-term setups detected." accent="bg-amber-50 text-amber-800" />
      <Section title="Avoid Now" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} items={avoidNow} emptyMsg="No avoid signals at this time." accent="bg-red-50 text-red-700" />
    </div>
  );
}

// ─── Tab 4: My Holdings ────────────────────────────────────────────────────

function MyHoldingsTab({
  portfolio,
  portfolioLoading,
  watchlistRows,
  onSaveHolding,
  onDeleteHolding,
  onUpdateCash,
}: {
  portfolio: PortfolioState;
  portfolioLoading: boolean;
  watchlistRows: RowData[];
  onSaveHolding: (symbol: string, avgPrice: number, qty: number) => Promise<void>;
  onDeleteHolding: (symbol: string) => Promise<void>;
  onUpdateCash: (cash: number) => Promise<void>;
}) {
  const [formSymbol, setFormSymbol] = useState(WATCHLIST[0].symbol);
  const [formAvgPrice, setFormAvgPrice] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState(portfolio.cashBalance.toString());
  const [cashSaving, setCashSaving] = useState(false);

  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);

  // Sync cashInput when portfolio.cashBalance changes from parent
  useEffect(() => {
    if (!editingCash) {
      setCashInput(portfolio.cashBalance.toString());
    }
  }, [portfolio.cashBalance, editingCash]);

  // Auto-fill avg price when symbol changes
  useEffect(() => {
    const row = watchlistRows.find((r) => r.symbol === formSymbol);
    if (row?.meta) {
      setFormAvgPrice(row.meta.regularMarketPrice.toFixed(
        row.meta.currency === "IDR" ? 0 : 2
      ));
    }
  }, [formSymbol, watchlistRows]);

  // ── Enriched holdings (merge portfolio + live prices) ────────────────────
  const enriched = portfolio.holdings.map((h) => {
    const row = watchlistRows.find((r) => r.symbol === h.symbol);
    const currentPrice = row?.meta?.regularMarketPrice ?? null;
    const currency = row?.meta?.currency ?? "USD";
    const region = row?.region ?? ("US" as const);
    const pnlPct =
      currentPrice !== null
        ? ((currentPrice - h.averagePrice) / h.averagePrice) * 100
        : null;
    const marketValue = currentPrice !== null ? currentPrice * h.quantity : null;
    const pnlAbs = marketValue !== null ? marketValue - h.averagePrice * h.quantity : null;

    // Personalized recommendation (needs chartData from the watchlist row)
    let personalRec: Analysis | null = null;
    if (row?.chartData.length && row?.meta) {
      personalRec = generateAnalysis(
        row.chartData,
        row.meta,
        { averagePrice: h.averagePrice, quantity: h.quantity },
        portfolio.cashBalance
      );
    }

    return {
      ...h,
      currentPrice,
      currency,
      region,
      pnlPct,
      marketValue,
      pnlAbs,
      personalRec,
    };
  });

  // ── Portfolio summary metrics ─────────────────────────────────────────────
  const totalMarketValue = enriched.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const totalCost = portfolio.holdings.reduce((s, h) => s + h.averagePrice * h.quantity, 0);
  const totalAssets = portfolio.cashBalance + totalMarketValue;
  const totalPnL = totalMarketValue > 0 ? totalMarketValue - totalCost : 0;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Detect mixed currencies (for the summary note)
  const hasMixedCurrency =
    enriched.some((h) => h.currency === "IDR") &&
    enriched.some((h) => h.currency === "USD");

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const avgPrice = parseFloat(formAvgPrice);
    const qty = parseFloat(formQty);
    if (isNaN(avgPrice) || avgPrice <= 0 || isNaN(qty) || qty <= 0) {
      setFormError("Average price and quantity must be positive numbers.");
      return;
    }
    setFormSaving(true);
    try {
      await onSaveHolding(formSymbol, avgPrice, qty);
      setFormQty("");
    } catch {
      setFormError("Failed to save holding. Is the backend running?");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleSaveCash() {
    const val = parseFloat(cashInput);
    if (isNaN(val) || val < 0) return;
    setCashSaving(true);
    try {
      await onUpdateCash(val);
      setEditingCash(false);
    } finally {
      setCashSaving(false);
    }
  }

  async function handleDelete(symbol: string) {
    setDeletingSymbol(symbol);
    try {
      await onDeleteHolding(symbol);
    } finally {
      setDeletingSymbol(null);
    }
  }

  const formRow = watchlistRows.find((r) => r.symbol === formSymbol);

  return (
    <div className="space-y-6">
      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Assets */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Est. Total Assets
          </p>
          <p className="text-2xl font-black text-gray-900 leading-none">
            {totalMarketValue > 0
              ? totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : portfolio.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          {hasMixedCurrency && (
            <p className="text-[10px] text-amber-500 mt-1">Mixed currencies — not directly comparable</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Cash + {enriched.length} holding{enriched.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Total Return */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Unrealized P&amp;L
          </p>
          {totalMarketValue > 0 ? (
            <>
              <p
                className={`text-2xl font-black leading-none ${
                  totalPnL >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {totalPnL >= 0 ? "+" : ""}
                {totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p
                className={`text-sm font-semibold mt-1 ${
                  totalPnLPct >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {totalPnLPct >= 0 ? "+" : ""}
                {totalPnLPct.toFixed(2)}%
              </p>
            </>
          ) : (
            <p className="text-2xl font-black text-gray-300 leading-none">—</p>
          )}
        </div>

        {/* Cash Balance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Buying Power (Cash)
          </p>
          {editingCash ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                className="flex-1 border border-indigo-300 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                onClick={handleSaveCash}
                disabled={cashSaving}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setEditingCash(false); setCashInput(portfolio.cashBalance.toString()); }}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2">
              <p className="text-2xl font-black text-indigo-600 leading-none">
                {portfolio.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <button
                onClick={() => setEditingCash(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors mb-0.5"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1.5">Available to invest</p>
        </div>
      </div>

      {portfolioLoading && (
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="text-xs text-indigo-700">Syncing portfolio…</span>
        </div>
      )}

      {/* ── Add / update holding form ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-gray-900">Add / Update Holding</h3>
        </div>
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Symbol dropdown */}
          <div className="sm:col-span-1">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Symbol
            </label>
            <select
              value={formSymbol}
              onChange={(e) => setFormSymbol(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            >
              {WATCHLIST.map((w) => (
                <option key={w.symbol} value={w.symbol}>
                  {w.symbol} — {w.name}
                </option>
              ))}
            </select>
            {formRow?.meta && (
              <p className="text-[10px] text-gray-400 mt-1">
                Current: {formRow.meta.currency === "USD" ? "$" : "Rp "}
                {fmtPrice(formRow.meta.regularMarketPrice, formRow.meta.currency)}
              </p>
            )}
          </div>

          {/* Average price */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Avg Price
            </label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 9500"
              value={formAvgPrice}
              onChange={(e) => setFormAvgPrice(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Quantity
            </label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 100"
              value={formQty}
              onChange={(e) => setFormQty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Save button */}
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={formSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              {formSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {formSaving ? "Saving…" : "Save Holding"}
            </button>
          </div>
        </form>
        {formError && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {formError}
          </p>
        )}
      </div>

      {/* ── Holdings table ─────────────────────────────────────────────────── */}
      {portfolio.holdings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center gap-3">
          <Wallet className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-semibold text-gray-400">No holdings yet</p>
          <p className="text-xs text-gray-400">
            Use the form above to add your first position.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
              Your Holdings · {enriched.length} position{enriched.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    "Symbol", "Avg Price", "Current Price",
                    "Qty", "Market Value", "P&L", "Signal", "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                        ["Avg Price", "Current Price", "Market Value", "P&L"].includes(h)
                          ? "text-right"
                          : ["Qty", "Signal", "Action"].includes(h)
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enriched.map((h) => {
                  const prefix = h.currency === "IDR" ? "Rp " : "$";
                  return (
                    <tr
                      key={h.symbol}
                      className="hover:bg-indigo-50/20 transition-colors"
                    >
                      {/* Symbol */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 text-sm">
                            {h.symbol}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              h.region === "ID"
                                ? "bg-red-50 text-red-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {h.region}
                          </span>
                        </div>
                      </td>

                      {/* Avg Price */}
                      <td className="px-4 py-4 text-right">
                        <span className="font-mono text-gray-700">
                          {prefix}{fmtPrice(h.averagePrice, h.currency)}
                        </span>
                      </td>

                      {/* Current Price */}
                      <td className="px-4 py-4 text-right">
                        {h.currentPrice !== null ? (
                          <span className="font-mono font-semibold text-gray-900">
                            {prefix}{fmtPrice(h.currentPrice, h.currency)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Loading…</span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-4 text-center">
                        <span className="font-mono text-gray-700">
                          {h.quantity.toLocaleString()}
                        </span>
                      </td>

                      {/* Market Value */}
                      <td className="px-4 py-4 text-right">
                        {h.marketValue !== null ? (
                          <span className="font-mono font-semibold text-gray-900">
                            {prefix}{fmtPrice(h.marketValue, h.currency)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* P&L */}
                      <td className="px-4 py-4 text-right">
                        {h.pnlPct !== null && h.pnlAbs !== null ? (
                          <div>
                            <span
                              className={`font-mono font-bold text-sm ${
                                h.pnlPct >= 0 ? "text-emerald-600" : "text-red-500"
                              }`}
                            >
                              {h.pnlPct >= 0 ? "+" : ""}
                              {h.pnlPct.toFixed(2)}%
                            </span>
                            <p
                              className={`text-[10px] font-mono ${
                                h.pnlAbs >= 0 ? "text-emerald-500" : "text-red-400"
                              }`}
                            >
                              {h.pnlAbs >= 0 ? "+" : ""}
                              {prefix}{fmtPrice(Math.abs(h.pnlAbs), h.currency)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Personalized Signal */}
                      <td className="px-4 py-4 text-center">
                        {h.personalRec ? (
                          <RecBadge rec={h.personalRec.recommendation} />
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleDelete(h.symbol)}
                          disabled={deletingSymbol === h.symbol}
                          className="inline-flex items-center justify-center w-7 h-7 text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-lg transition-colors"
                          title={`Remove ${h.symbol}`}
                        >
                          {deletingSymbol === h.symbol ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: How to Read ─────────────────────────────────────────────────────

function HowToReadTab() {
  const cards = [
    {
      icon: <Activity className="w-5 h-5 text-indigo-500" />,
      title: "RSI — Relative Strength Index",
      accent: "border-indigo-100 bg-indigo-50/40",
      items: [
        "RSI measures the speed and magnitude of price changes (0–100 scale).",
        "Below 35 → Oversold. Prices may be depressed; historically a buying zone.",
        "Above 65 → Overbought. Prices may be extended; caution on new entries.",
        "MarketLens uses 14-period Wilder's smoothing — the industry standard.",
      ],
    },
    {
      icon: <BarChart2 className="w-5 h-5 text-violet-500" />,
      title: "MACD — Moving Average Convergence Divergence",
      accent: "border-violet-100 bg-violet-50/40",
      items: [
        "MACD Line = EMA(12) − EMA(26). Measures short-term vs long-term momentum.",
        "Signal Line = EMA(9) of MACD. Crossovers generate buy/sell signals.",
        "Histogram = MACD − Signal. Green bars: bullish pressure. Red: bearish.",
        "Histogram crossing zero → a momentum shift — scored +2 or −2.",
      ],
    },
    {
      icon: <Layers className="w-5 h-5 text-amber-500" />,
      title: "Moving Averages (MA20, MA50, MA200)",
      accent: "border-amber-100 bg-amber-50/40",
      items: [
        "MA20 (amber): Short-term trend. Reactive to recent price action.",
        "MA50 (purple): Medium-term trend. Popular institutional reference.",
        "MA200 (red, dashed): Long-term trend. Defines bull/bear market regime.",
        "Golden Cross (MA20 > MA50): Bullish crossover. Scored +3.",
        "Death Cross (MA20 < MA50): Bearish reversal signal. Scored −3.",
      ],
    },
    {
      icon: <Wallet className="w-5 h-5 text-teal-500" />,
      title: "Personalized Signals (My Holdings)",
      accent: "border-teal-100 bg-teal-50/40",
      items: [
        "AVERAGE DOWN: Tech is bullish + you're >3% in loss + have cash → lower your cost basis.",
        "TAKE PROFIT: Tech is bearish + you're >5% in profit → lock in some gains.",
        "CUT LOSS: Tech is bearish + you're >8% in loss → risk management exit signal.",
        "HOLD (No Buying Power): Tech is bullish but no cash to add → sit tight.",
        "Personalized signals require a holding entry in the My Holdings tab.",
      ],
    },
    {
      icon: <Info className="w-5 h-5 text-emerald-500" />,
      title: "Scoring Engine",
      accent: "border-emerald-100 bg-emerald-50/40",
      items: [
        "Each signal contributes a score. Signals stack additively.",
        "≥ 7 pts → STRONG BUY · ≥ 4 pts → BUY · ≥ 0 → HOLD",
        "≥ −3 pts → REDUCE · < −3 pts → AVOID",
        "Personalized overrides (above) supersede the pure technical level.",
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div key={card.title} className={`rounded-2xl border p-5 space-y-3 ${card.accent}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
              {card.icon}
            </div>
            <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
          </div>
          <ul className="space-y-1.5">
            {card.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="md:col-span-2 bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Disclaimer:</strong> MarketLens provides technical analysis for educational
            purposes only. It does not constitute financial advice. Past technical signals do not
            guarantee future returns. Always conduct your own research and consult a licensed
            financial advisor before making any investment decision.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type Tab = "watchlist" | "chart" | "holdings" | "recommendations" | "howto";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "watchlist", label: "Watchlist", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "chart", label: "Chart View", icon: <Activity className="w-4 h-4" /> },
  { id: "holdings", label: "My Holdings", icon: <Wallet className="w-4 h-4" /> },
  { id: "recommendations", label: "Recommendations", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "howto", label: "How to Read", icon: <BookOpen className="w-4 h-4" /> },
];

export default function MarketLensPage() {
  // ── Watchlist ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("watchlist");
  const [watchlistRows, setWatchlistRows] = useState<RowData[]>(
    WATCHLIST.map((e) => ({
      ...e,
      meta: null,
      chartData: [],
      rsi: null,
      analysis: null,
      loading: true,
      error: false,
    }))
  );

  const loadWatchlist = useCallback(() => {
    WATCHLIST.forEach(async (entry, idx) => {
      setWatchlistRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], loading: true, error: false };
        return next;
      });
      try {
        const res = await fetch(
          `${API_URL}/market/chart/${encodeURIComponent(entry.symbol)}?range=3mo&interval=1d`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const parsed = parseYahoo(raw);
        if (!parsed) throw new Error("parse error");

        const { meta, chartData: cd } = parsed;
        const lastRsi = cd[cd.length - 1]?.rsi ?? null;
        const analysis = generateAnalysis(cd, meta);

        setWatchlistRows((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], meta, chartData: cd, rsi: lastRsi, analysis, loading: false, error: false };
          return next;
        });
      } catch {
        setWatchlistRows((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], loading: false, error: true };
          return next;
        });
      }
    });
  }, []);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  // ── Chart view ───────────────────────────────────────────────────────────
  const [selectedSymbol, setSelectedSymbol] = useState<string>(WATCHLIST[0].symbol);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartMeta, setChartMeta] = useState<StockMeta | null>(null);
  const [chartAnalysis, setChartAnalysis] = useState<Analysis | null>(null);
  const [chartRange, setChartRange] = useState("3mo");
  const [chartLoading, setChartLoading] = useState(false);

  const loadChart = useCallback(async (symbol: string, range: string) => {
    setChartLoading(true);
    setChartData([]);
    setChartMeta(null);
    setChartAnalysis(null);
    try {
      const rangeObj = RANGES.find((r) => r.value === range);
      const interval = rangeObj?.interval ?? "1d";
      const res = await fetch(
        `${API_URL}/market/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const parsed = parseYahoo(raw);
      if (parsed) {
        setChartData(parsed.chartData);
        setChartMeta(parsed.meta);
        setChartAnalysis(generateAnalysis(parsed.chartData, parsed.meta));
      }
    } catch {
      // Error state shown in ChartTab
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => { loadChart(selectedSymbol, chartRange); }, [selectedSymbol, chartRange, loadChart]);

  function handleViewChart(symbol: string) {
    setSelectedSymbol(symbol);
    setActiveTab("chart");
  }

  // ── Portfolio ─────────────────────────────────────────────────────────────
  const [portfolio, setPortfolio] = useState<PortfolioState>({ cashBalance: 0, holdings: [] });
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const res = await fetch(`${API_URL}/portfolio/${USER_ID}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      setPortfolio({
        cashBalance: data.cash_balance ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        holdings: (data.holdings ?? []).map((h: any) => ({
          id: h.id,
          symbol: h.symbol,
          averagePrice: h.average_price,
          quantity: h.quantity,
        })),
      });
    } catch {
      // Keep empty portfolio on error
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  const handleSaveHolding = useCallback(async (symbol: string, avgPrice: number, qty: number) => {
    const res = await fetch(`${API_URL}/portfolio/${USER_ID}/holdings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, average_price: avgPrice, quantity: qty }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadPortfolio();
  }, [loadPortfolio]);

  const handleDeleteHolding = useCallback(async (symbol: string) => {
    const res = await fetch(
      `${API_URL}/portfolio/${USER_ID}/holdings/${encodeURIComponent(symbol)}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadPortfolio();
  }, [loadPortfolio]);

  const handleUpdateCash = useCallback(async (cashBalance: number) => {
    const res = await fetch(`${API_URL}/portfolio/${USER_ID}/cash`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cash_balance: cashBalance }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadPortfolio();
  }, [loadPortfolio]);

  const loadingCount = watchlistRows.filter((r) => r.loading).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="leading-none">
              <p className="font-black text-gray-900 tracking-tight">MarketLens</p>
              <p className="text-[10px] text-indigo-500 font-semibold tracking-wide uppercase">
                Live Market Intelligence · Portfolio Advisor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {loadingCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium border border-indigo-100">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {loadingCount} loading
              </div>
            )}
            <button
              onClick={loadWatchlist}
              disabled={loadingCount > 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCount > 0 ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 py-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "holdings" && portfolio.holdings.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-white/30 rounded-full text-[10px] font-bold">
                    {portfolio.holdings.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "watchlist" && (
          <WatchlistTab rows={watchlistRows} onViewChart={handleViewChart} />
        )}
        {activeTab === "chart" && (
          <ChartTab
            rows={watchlistRows}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            chartData={chartData}
            meta={chartMeta}
            analysis={chartAnalysis}
            chartRange={chartRange}
            onRangeChange={setChartRange}
            loading={chartLoading}
          />
        )}
        {activeTab === "holdings" && (
          <MyHoldingsTab
            portfolio={portfolio}
            portfolioLoading={portfolioLoading}
            watchlistRows={watchlistRows}
            onSaveHolding={handleSaveHolding}
            onDeleteHolding={handleDeleteHolding}
            onUpdateCash={handleUpdateCash}
          />
        )}
        {activeTab === "recommendations" && (
          <RecommendationsTab rows={watchlistRows} />
        )}
        {activeTab === "howto" && <HowToReadTab />}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-4 border-t border-gray-100 mt-4">
        <p className="text-xs text-gray-400 text-center">
          wondr Intelligence Engine · MarketLens · Data proxied via FastAPI from Yahoo Finance · Not financial advice
        </p>
      </footer>
    </div>
  );
}
