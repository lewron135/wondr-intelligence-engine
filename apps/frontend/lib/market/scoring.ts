import type {
  Analysis,
  ChartData,
  RecommendationLevel,
  Signal,
  StockMeta,
} from "@/types/market";

// ─── Helpers ───────────────────────────────────────────────────────────────

function mapScoreToRec(score: number): RecommendationLevel {
  if (score >= 7) return "STRONG BUY";
  if (score >= 4) return "BUY";
  if (score >= 0) return "HOLD";
  if (score >= -3) return "REDUCE";
  return "AVOID";
}

// ─── Core analysis ─────────────────────────────────────────────────────────

/**
 * @param chartData   Full OHLCV + indicator history for the symbol.
 * @param meta        Latest market meta (price, 52W range, etc.).
 * @param userHolding Optional holding data that enables personalized signals.
 * @param cashBalance Available buying power in the user's portfolio.
 */
export function generateAnalysis(
  chartData: ChartData[],
  meta: StockMeta,
  userHolding?: { averagePrice: number; quantity: number } | null,
  cashBalance?: number
): Analysis {
  const signals: Signal[] = [];
  let score = 0;

  if (chartData.length < 2) {
    return { score: 0, recommendation: "HOLD", signals: [] };
  }

  const last = chartData[chartData.length - 1];
  const prev = chartData[chartData.length - 2];

  // ── RSI ────────────────────────────────────────────────────────────────
  if (last.rsi !== null) {
    if (last.rsi < 35) {
      score += 3;
      signals.push({
        label: "Oversold (RSI)",
        score: 3,
        description: `RSI at ${last.rsi.toFixed(1)} — historically signals a buying opportunity.`,
        type: "bullish",
      });
    } else if (last.rsi > 65) {
      score -= 2;
      signals.push({
        label: "Overbought (RSI)",
        score: -2,
        description: `RSI at ${last.rsi.toFixed(1)} — stock may be overextended.`,
        type: "bearish",
      });
    }
  }

  // ── Golden / Death Cross ───────────────────────────────────────────────
  if (
    last.ma20 !== null &&
    last.ma50 !== null &&
    prev.ma20 !== null &&
    prev.ma50 !== null
  ) {
    if (last.ma20 > last.ma50 && prev.ma20 <= prev.ma50) {
      score += 3;
      signals.push({
        label: "Golden Cross",
        score: 3,
        description: "MA20 crossed above MA50 — long-term bullish momentum confirmation.",
        type: "bullish",
      });
    } else if (last.ma20 < last.ma50 && prev.ma20 >= prev.ma50) {
      score -= 3;
      signals.push({
        label: "Death Cross",
        score: -3,
        description: "MA20 crossed below MA50 — bearish momentum reversal signal.",
        type: "bearish",
      });
    }
  }

  // ── MACD crossovers ────────────────────────────────────────────────────
  if (last.macdHist !== null && prev.macdHist !== null) {
    if (last.macdHist > 0 && prev.macdHist <= 0) {
      score += 2;
      signals.push({
        label: "MACD Bullish Crossover",
        score: 2,
        description: "MACD histogram crossed into positive territory.",
        type: "bullish",
      });
    } else if (last.macdHist < 0 && prev.macdHist >= 0) {
      score -= 2;
      signals.push({
        label: "MACD Bearish Crossover",
        score: -2,
        description: "MACD histogram crossed into negative territory.",
        type: "bearish",
      });
    }
  }

  // ── 52-Week proximity ──────────────────────────────────────────────────
  if (meta.fiftyTwoWeekLow > 0) {
    const distFromLow =
      (last.close - meta.fiftyTwoWeekLow) / meta.fiftyTwoWeekLow;
    if (distFromLow < 0.05) {
      score += 2;
      signals.push({
        label: "Near 52-Week Low",
        score: 2,
        description: `Price within 5% of 52-week low (${meta.fiftyTwoWeekLow.toLocaleString()}).`,
        type: "bullish",
      });
    }
  }

  if (meta.fiftyTwoWeekHigh > 0) {
    const distFromHigh =
      (meta.fiftyTwoWeekHigh - last.close) / meta.fiftyTwoWeekHigh;
    if (distFromHigh < 0.03) {
      score -= 1;
      signals.push({
        label: "Near 52-Week High",
        score: -1,
        description: "Price within 3% of 52-week high — potential resistance.",
        type: "bearish",
      });
    }
  }

  // ── Fallback neutral signal ────────────────────────────────────────────
  if (signals.length === 0) {
    signals.push({
      label: "No Strong Signals",
      score: 0,
      description: "Current indicators show neutral market conditions.",
      type: "neutral",
    });
  }

  // ── Derive initial (technical) recommendation ──────────────────────────
  let recommendation: RecommendationLevel = mapScoreToRec(score);

  // ── Personalized override (requires a user holding) ────────────────────
  if (userHolding && last.close > 0) {
    const currentPrice = last.close;
    const avgPrice = userHolding.averagePrice;
    const qty = userHolding.quantity;
    const pnlPct = ((currentPrice - avgPrice) / avgPrice) * 100;
    const pnlAbs = (currentPrice - avgPrice) * qty;
    const cash = cashBalance ?? 0;

    // Prepend a "Your Position" info signal
    signals.unshift({
      label: "Your Position",
      score: 0,
      description:
        `Entry: ${avgPrice.toLocaleString()} · Qty: ${qty.toLocaleString()} · ` +
        `Unrealized P&L: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% ` +
        `(${pnlAbs >= 0 ? "+" : ""}${pnlAbs.toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
      type: pnlPct >= 0 ? "bullish" : pnlPct < -5 ? "bearish" : "neutral",
    });

    // Override logic
    if (recommendation === "STRONG BUY" || recommendation === "BUY") {
      if (pnlPct < -3 && cash > currentPrice) {
        recommendation = "AVERAGE DOWN";
        signals.push({
          label: "Average Down Opportunity",
          score: 2,
          description:
            `Down ${Math.abs(pnlPct).toFixed(1)}% from entry with bullish technicals — ` +
            `cash balance is sufficient to lower your cost basis.`,
          type: "bullish",
        });
      } else if (cash <= 0) {
        recommendation = "HOLD (No Buying Power)";
        signals.push({
          label: "No Buying Power",
          score: 0,
          description:
            "Technical signal is bullish but no cash available to add. Hold current position.",
          type: "neutral",
        });
      }
    } else if (recommendation === "REDUCE" || recommendation === "AVOID") {
      if (pnlPct > 5) {
        recommendation = "TAKE PROFIT";
        signals.push({
          label: "Take Profit",
          score: -1,
          description:
            `Up ${pnlPct.toFixed(1)}% from entry. Technicals are weakening — ` +
            `consider locking in some gains.`,
          type: "bearish",
        });
      } else if (pnlPct < -8) {
        recommendation = "CUT LOSS";
        signals.push({
          label: "Stop Loss Triggered",
          score: -3,
          description:
            `Down ${Math.abs(pnlPct).toFixed(1)}% from entry with negative technicals. ` +
            `Risk management suggests reducing or exiting the position.`,
          type: "bearish",
        });
      }
    }
  }

  return { score, recommendation, signals };
}
