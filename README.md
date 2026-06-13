<div align="center">

# Financial Intelligence Engine

### Wealth Management & Market Intelligence OS

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)

*An end-to-end financial intelligence platform combining ML-powered personal finance tracking, live market analysis, and a Gemini-powered AI investment advisor — all in a single monorepo.*

---

</div>

## Overview

**wondr Intelligence Engine** is a full-stack Wealth Management OS built for the modern investor. It ingests raw bank statement PDFs, runs ML anomaly detection and bill forecasting on your transaction history, and pairs that with a real-time stock market terminal covering both Indonesian (IDX) and US equities. An integrated Gemini AI analyst synthesises live technical indicators and fundamentals into professional-grade investment analysis on demand.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      wondr Intelligence Engine                      │
│                                                                     │
│   PDF / Bank Statement                                              │
│          │                                                          │
│          ▼                                                          │
│   ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│   │  Smart ETL  │───▶│  Finance ML Core │───▶│  FastAPI Layer  │   │
│   │  Pipeline   │    │  Anomaly + Bills │    │   REST + ORM    │   │
│   └─────────────┘    └──────────────────┘    └────────┬────────┘   │
│                                                        │            │
│                                                        ▼            │
│                                              ┌─────────────────┐   │
│   Yahoo Finance ──▶  MarketLens Terminal ───▶│   Next.js 14    │   │
│                                              │  App Router UI  │   │
│   Gemini 2.5 Flash ▶  AI Financial Agent ──▶│                 │   │
│                                              └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. 📄 Smart ETL Pipeline
> `apps/backend/services/` · `POST /parse-pdf`

A bulletproof PDF ingestion engine built for unstructured Indonesian bank statement formats (BCA, Mandiri, BRI, BNI).

- **Row unzipping algorithm** — handles multi-row transactions merged into single cells by PDF rendering engines
- **Regex-driven field extraction** — date, description, debit/credit, and balance parsed from freeform text
- **pdfplumber + pytesseract fallback** — structured extraction first, OCR fallback for scanned/image PDFs
- **Idempotent upsert** — re-uploading the same statement never creates duplicate transactions

### 2. 🧠 Finance ML Core
> `apps/backend/services/anomaly_detector.py` · `services/bill_forecaster.py`

Background ML pipeline that runs asynchronously on every new transaction batch.

- **Anomaly Detection** — Isolation Forest trained on amount, hour-of-day, and merchant-category features; flags statistical outliers as suspicious transactions
- **Bill Forecasting** — Time-series model (Prophet-compatible, Python 3.13 fixed) identifies recurring charges and predicts next payment dates and amounts
- **Rule-Based Recommendation Engine** — financial goal tracking with savings redirect suggestions

### 3. 📈 MarketLens Terminal
> `apps/frontend/app/porto/` · `GET /market/chart/{symbol}` · `GET /market/summary/{symbol}`

A fully-featured real-time stock market dashboard for Indonesian (IDX) and US equities.

| Feature | Detail |
|---|---|
| **Live Data** | Yahoo Finance v8/v10 API proxied through FastAPI (CORS bypass) |
| **Markets** | IDX (`.JK` suffix) and US (NASDAQ / NYSE) with fractional share support |
| **Technical Indicators** | RSI-14, MA20/MA50/MA200, MACD (12,26,9), Volume — computed client-side |
| **Scoring Engine** | Rule-based signal stacker producing STRONG BUY → AVOID recommendations |
| **Portfolio Tracker** | Add holdings (lots for IDR, total-invested for USD fractional shares), live P&L, personalised signals |
| **Caching** | 60-second server-side cache per symbol to respect Yahoo Finance rate limits |

### 4. 🤖 AI Financial Agent
> `apps/backend/routers/ai_analyst.py` · `GET /market/analyze/{symbol}`

On-demand AI analysis powered by **Gemini 2.5 Flash** that synthesises live market data into professional investment reports.

- Fetches live chart + fundamental data from Yahoo Finance on every request
- Computes RSI, MA20/MA50, and MACD in Python before prompt injection
- Constructs a structured prompt with full technical and fundamental context
- Returns a **4-section markdown report**: Technical Setup · Fundamental Overview · Bull/Bear Case · Final Verdict
- Rendered inline in the **Analysis Modal** using `react-markdown` with styled typography
- 5-minute server-side cache to avoid redundant Gemini API calls
- Search any ticker from the persistent search bar — not limited to the watchlist

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | React SSR framework, client components |
| **UI** | Tailwind CSS + Tremor | Styling and component primitives |
| **Charts** | Recharts | Composable charting (price, RSI, MACD, volume) |
| **Backend** | FastAPI + Uvicorn | Async REST API, router-based architecture |
| **ORM** | SQLAlchemy + SQLite | Transaction, portfolio, and insight persistence |
| **ML** | scikit-learn (Isolation Forest) | Anomaly detection pipeline |
| **PDF** | pdfplumber + pytesseract | Bank statement ETL |
| **Market Data** | Yahoo Finance v8/v10 API | Price, chart, and fundamental data |
| **AI** | Google Gemini 2.5 Flash | Natural language financial analysis |
| **Auth** | Hardcoded `usr_123` | Demo-mode only (production: add JWT/OAuth) |

---

## Getting Started

### Prerequisites

- Python 3.11+ (3.13 recommended)
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key for Gemini

### 1. Clone the repo

```bash
git clone https://github.com/your-username/wondr-intelligence-engine.git
cd wondr-intelligence-engine
```

### 2. Backend setup

```bash
cd apps/backend

# Create and activate the virtual environment
python3 -m venv wondr-env
source wondr-env/bin/activate          # Windows: wondr-env\Scripts\activate

# Install all dependencies
pip install -r requirements.txt

# Install the Gemini SDK and dotenv (if not already in requirements.txt)
pip install google-generativeai python-dotenv
```

### 3. Configure environment variables

Create a `.env` file inside `apps/backend/`:

```bash
# apps/backend/.env  ← this file is gitignored, never committed
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```

> **Security note:** Both the root `.gitignore` and `apps/backend/.gitignore` block all `.env*` patterns. This file will never be staged by git.

### 4. Start the FastAPI server

```bash
# From apps/backend/, with wondr-env activated
uvicorn main:app --reload --port 8000
```

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 5. Frontend setup

```bash
cd apps/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

App: [http://localhost:3000/porto](http://localhost:3000/porto)

### 6. Running both concurrently

```bash
# Terminal 1 — Backend
cd apps/backend && source wondr-env/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd apps/frontend && npm run dev
```

---

## Project Structure

```
wondr-intelligence-engine/
├── apps/
│   ├── backend/
│   │   ├── main.py                    # FastAPI app, router registration, CORS
│   │   ├── database.py                # SQLAlchemy engine + session
│   │   ├── models/                    # ORM models (Transaction, Portfolio, Insight…)
│   │   ├── routers/
│   │   │   ├── market.py              # Yahoo Finance proxy (chart + summary)
│   │   │   ├── ai_analyst.py          # Gemini AI analysis endpoint
│   │   │   ├── portfolio.py           # Holdings CRUD + cash balance
│   │   │   ├── transaction.py         # Transaction ingestion + listing
│   │   │   ├── insight.py             # Anomaly + ML insight endpoints
│   │   │   └── recommendation.py      # Rule-based financial recommendations
│   │   ├── services/
│   │   │   ├── anomaly_detector.py    # Isolation Forest ML pipeline
│   │   │   ├── bill_forecaster.py     # Recurring charge prediction
│   │   │   ├── categorizer.py         # Merchant category classifier
│   │   │   ├── ml_pipeline.py         # Async background task orchestrator
│   │   │   └── recommendation.py      # Goal tracking + savings logic
│   │   ├── requirements.txt
│   │   └── .env                       # ← GITIGNORED — add GEMINI_API_KEY here
│   └── frontend/
│       ├── app/
│       │   ├── porto/
│       │   │   └── page.tsx           # MarketLens + AI Analyst + Portfolio UI
│       │   └── layout.tsx
│       ├── constants/
│       │   └── watchlist.ts           # Tracked symbols (ID + US)
│       ├── lib/market/
│       │   ├── indicators.ts          # RSI, SMA, EMA, MACD implementations
│       │   └── scoring.ts             # Recommendation scoring engine
│       └── types/market.ts            # Shared TypeScript interfaces
├── .gitignore                         # Root-level — blocks secrets, DBs, images, venvs
└── README.md
```

---

## Key Design Decisions

**Why proxy Yahoo Finance through FastAPI?**
Browser requests to `query1.finance.yahoo.com` are blocked by CORS. The FastAPI layer injects a `User-Agent` header and caches for 60 seconds, giving the frontend clean JSON with no CORS issues and reduced API load.

**Why fractional shares for US stocks?**
Indonesian brokers (e.g. Ajaib) show US positions as "Average Price" + "Total Invested" rather than explicit share counts. The portfolio form accepts Total Invested, derives `quantity = invested / avg_price` client-side, and stores fractional shares in the DB — no schema changes needed.

**Why Isolation Forest for anomaly detection?**
It is unsupervised (no labelled fraud data required), handles high-dimensional tabular data well, and runs fast enough for background async tasks without a GPU.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/transactions` | Ingest transaction, trigger ML pipeline |
| `GET` | `/insights/{user_id}` | Retrieve anomaly + forecast insights |
| `GET` | `/recommendations/{user_id}` | Rule-based growth recommendations |
| `GET` | `/portfolio/{user_id}` | Holdings + cash balance |
| `POST` | `/portfolio/{user_id}/holdings` | Add or update a holding |
| `DELETE` | `/portfolio/{user_id}/holdings/{symbol}` | Remove a holding |
| `PUT` | `/portfolio/{user_id}/cash` | Update cash / buying power |
| `GET` | `/market/chart/{symbol}` | Yahoo Finance chart proxy (OHLCV) |
| `GET` | `/market/summary/{symbol}` | Yahoo Finance fundamental summary |
| `GET` | `/market/analyze/{symbol}` | Gemini AI full investment analysis |

---

## Roadmap

- [ ] JWT authentication + multi-user support
- [ ] Plaid / Belvo API integration for automatic transaction sync
- [ ] Vector DB (ChromaDB) for true RAG over personal transaction history
- [ ] Push notifications for anomaly alerts
- [ ] Mobile app (React Native) consuming the same FastAPI backend
- [ ] Docker Compose for one-command local setup
- [ ] PostgreSQL migration for production deployment

---

## Disclaimer

> wondr Intelligence Engine is built for **educational and personal use only**. MarketLens and the AI Financial Agent do not constitute financial advice. All analysis is based on publicly available data and algorithmic signals. Always consult a licensed financial advisor before making investment decisions.

---

<div align="center">

Built with ❤️ using FastAPI · Next.js · Gemini · Python

</div>