// ── Technical recommendation levels ───────────────────────────────────────
export type RecommendationLevel =
  | "STRONG BUY"
  | "BUY"
  | "HOLD"
  | "REDUCE"
  | "AVOID"
  // Personalized overrides (require a user holding + cash balance)
  | "AVERAGE DOWN"
  | "TAKE PROFIT"
  | "CUT LOSS"
  | "HOLD (No Buying Power)";

// ── Market data ────────────────────────────────────────────────────────────
export interface StockMeta {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketVolume: number;
}

export interface ChartData {
  timestamp: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  macdHist: number | null;
  macdLine: number | null;
  macdSignal: number | null;
}

export interface Signal {
  label: string;
  score: number;
  description: string;
  type: "bullish" | "bearish" | "neutral";
}

export interface Analysis {
  score: number;
  recommendation: RecommendationLevel;
  signals: Signal[];
}

export interface WatchlistEntry {
  symbol: string;
  name: string;
  region: "ID" | "US";
}

// ── Portfolio ──────────────────────────────────────────────────────────────
export interface PortfolioHolding {
  id?: number;
  symbol: string;
  averagePrice: number;
  quantity: number;
}

export interface PortfolioSummary {
  cashBalance: number;
  holdings: PortfolioHolding[];
  /** sum of averagePrice × quantity for all holdings */
  totalInvested: number;
  /** sum of (currentPrice − averagePrice) × quantity — requires live prices */
  unrealizedPnL: number;
}
