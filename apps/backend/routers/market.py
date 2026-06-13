import time
from typing import Any, Dict, Tuple

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/market", tags=["Market Intelligence"])

YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 60  # seconds


def _get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < CACHE_TTL:
        return entry[1]
    return None


def _set(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


@router.get("/chart/{symbol}")
async def get_chart(
    symbol: str,
    range: str = Query(default="1mo"),
    interval: str = Query(default="1d"),
):
    key = f"chart:{symbol}:{range}:{interval}"
    cached = _get(key)
    if cached is not None:
        return cached

    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range={range}&interval={interval}&includePrePost=false&events=div"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, headers=YAHOO_HEADERS)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Yahoo Finance error: {exc.response.text[:200]}",
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Yahoo Finance unreachable: {exc}")

    data = resp.json()
    _set(key, data)
    return data


@router.get("/summary/{symbol}")
async def get_summary(symbol: str):
    key = f"summary:{symbol}"
    cached = _get(key)
    if cached is not None:
        return cached

    url = (
        f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
        "?modules=defaultKeyStatistics,summaryDetail,financialData,assetProfile"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, headers=YAHOO_HEADERS)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Yahoo Finance error: {exc.response.text[:200]}",
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Yahoo Finance unreachable: {exc}")

    data = resp.json()
    _set(key, data)
    return data
