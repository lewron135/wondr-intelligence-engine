import os
import time
import traceback
from typing import Any, Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
import google.generativeai as genai

load_dotenv()

router = APIRouter(prefix="/market", tags=["AI Analyst"])

YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300  # 5-minute cache for AI responses


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


# ── Technical Indicators ──────────────────────────────────────────────────────

def _sma(closes: List[float], period: int) -> List[Optional[float]]:
    result: List[Optional[float]] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        result[i] = sum(closes[i - period + 1 : i + 1]) / period
    return result


def _ema(closes: List[float], period: int) -> List[Optional[float]]:
    result: List[Optional[float]] = [None] * len(closes)
    if len(closes) < period:
        return result
    k = 2 / (period + 1)
    result[period - 1] = sum(closes[:period]) / period
    for i in range(period, len(closes)):
        result[i] = closes[i] * k + result[i - 1] * (1 - k)  # type: ignore[operator]
    return result


def _rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(d, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0.0)) / period
    if avg_loss == 0:
        return 100.0
    return round(100 - (100 / (1 + avg_gain / avg_loss)), 2)


def _macd(closes: List[float]) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_line: List[Optional[float]] = [
        (ema12[i] - ema26[i])  # type: ignore[operator]
        if ema12[i] is not None and ema26[i] is not None
        else None
        for i in range(len(closes))
    ]
    valid_macd = [v for v in macd_line if v is not None]
    if len(valid_macd) < 9:
        return None, None, None
    first_idx = next(i for i, v in enumerate(macd_line) if v is not None)
    k = 2 / 10
    signal: List[Optional[float]] = [None] * len(closes)
    signal[first_idx + 8] = sum(valid_macd[:9]) / 9
    for i in range(first_idx + 9, len(closes)):
        signal[i] = macd_line[i] * k + signal[i - 1] * (1 - k)  # type: ignore[operator]
    last_macd = macd_line[-1]
    last_sig = signal[-1]
    last_hist = (last_macd - last_sig) if last_macd is not None and last_sig is not None else None  # type: ignore[operator]
    return (
        round(last_macd, 4) if last_macd is not None else None,
        round(last_sig, 4) if last_sig is not None else None,
        round(last_hist, 4) if last_hist is not None else None,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt(d: dict, key: str) -> str:
    v = d.get(key, {})
    raw = (v.get("fmt") or v.get("raw")) if isinstance(v, dict) else v
    return str(raw) if raw is not None else "N/A"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    try:
        sym = symbol.upper()
        cache_key = f"analysis:{sym}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        async with httpx.AsyncClient(timeout=20) as client:
            chart_url = (
                f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
                "?range=3mo&interval=1d&includePrePost=false&events=div"
            )
            try:
                chart_resp = await client.get(chart_url, headers=YAHOO_HEADERS)
                chart_resp.raise_for_status()
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Yahoo chart fetch failed: {exc}")

            summary_url = (
                f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{sym}"
                "?modules=defaultKeyStatistics,summaryDetail,financialData,assetProfile"
            )
            try:
                summary_resp = await client.get(summary_url, headers=YAHOO_HEADERS)
                summary_resp.raise_for_status()
                fund_raw = summary_resp.json()
            except Exception:
                fund_raw = {}

        chart_raw = chart_resp.json()
        result = chart_raw.get("chart", {}).get("result", [{}])[0]
        quote = result.get("indicators", {}).get("quote", [{}])[0]
        meta = result.get("meta", {})

        closes: List[float] = [c or 0.0 for c in (quote.get("close") or [])]
        if not closes:
            raise HTTPException(status_code=404, detail=f"No chart data found for {sym}")

        # ── Indicators ────────────────────────────────────────────────────────
        rsi_val = _rsi(closes)
        ma20 = next((v for v in reversed(_sma(closes, 20)) if v is not None), None)
        ma50 = next((v for v in reversed(_sma(closes, 50)) if v is not None), None)
        macd_val, macd_sig, macd_hist = _macd(closes)

        price: float = meta.get("regularMarketPrice") or closes[-1]
        prev_close: float = meta.get("previousClose") or meta.get("chartPreviousClose") or price
        change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0.0
        currency = meta.get("currency", "USD")
        high52 = meta.get("fiftyTwoWeekHigh", "N/A")
        low52 = meta.get("fiftyTwoWeekLow", "N/A")

        # ── Fundamentals ──────────────────────────────────────────────────────
        qs_result = (fund_raw.get("quoteSummary") or {}).get("result") or [{}]
        qs = qs_result[0] if qs_result else {}
        fin = qs.get("financialData") or {}
        stats = qs.get("defaultKeyStatistics") or {}
        profile = qs.get("assetProfile") or {}

        sector = profile.get("sector", "N/A")
        industry = profile.get("industry", "N/A")
        summary_blurb = (profile.get("longBusinessSummary") or "")[:600]

        # ── Prompt ────────────────────────────────────────────────────────────
        above_ma20 = "Above" if ma20 and price > ma20 else "Below"
        above_ma50 = "Above" if ma50 and price > ma50 else "Below"

        prompt = f"""You are an expert Quantitative Analyst. I will provide you with live technical and fundamental data for a stock. Provide a structured, professional markdown analysis covering: 1. Technical Setup, 2. Fundamental Overview, 3. Bull/Bear Case, 4. Final Verdict. Base your analysis STRICTLY on the data provided.

## Stock: {sym} | {currency} | Sector: {sector} | Industry: {industry}

### Technical Data
- Current Price: {price:.2f} ({change_pct:+.2f}% today)
- 52-Week Range: {low52} – {high52}
- RSI (14): {rsi_val if rsi_val is not None else "N/A"}
- MA20: {f"{ma20:.2f}" if ma20 else "N/A"} ({above_ma20} current price)
- MA50: {f"{ma50:.2f}" if ma50 else "N/A"} ({above_ma50} current price)
- MACD Line: {macd_val} | Signal: {macd_sig} | Histogram: {macd_hist}

### Fundamental Data
- Market Cap: {_fmt(stats, "marketCap")}
- Forward P/E: {_fmt(stats, "forwardPE")}
- Trailing P/E: {_fmt(stats, "trailingPE")}
- Total Revenue: {_fmt(fin, "totalRevenue")}
- Profit Margin: {_fmt(fin, "profitMargins")}
- Debt / Equity: {_fmt(fin, "debtToEquity")}
- Return on Equity: {_fmt(fin, "returnOnEquity")}
- Free Cash Flow: {_fmt(fin, "freeCashflow")}

### Business Summary
{summary_blurb}

Please provide your structured markdown analysis now:"""

        # ── Gemini call ───────────────────────────────────────────────────────
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        analysis_text: str = response.text

        payload = {"symbol": sym, "analysis": analysis_text}
        _cache_set(cache_key, payload)
        return payload

    except HTTPException:
        # Let FastAPI handle its own HTTPExceptions as-is
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
