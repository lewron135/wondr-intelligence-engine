# wondr Intelligence Engine
An ML-Powered Distributed Backend and UI for Personalized Digital Banking

## Background and Motivation
wondr by BNI, Indonesia's digital banking superapp, has 13.5 million registered users, yet only 54% actively engage with more than 4 features monthly. The core reason is that the platform's three financial dimensions (Transaction, Insight, and Growth) are siloed. Completing a transaction generates no automatic insight, and receiving an insight triggers no automatic growth recommendation.

This creates what behavioral economists call a habit gap, users have access to powerful features but no automated system that connects them into a meaningful daily experience. This engine bridges that gap through ML-powered behavioral analysis, making every transaction automatically meaningful by triggering personalized insights and growth recommendations in real time.

This project is built as a technical implementation of a solution proposed at GMBCC 2026 (Gadjah Mada Business Case Competition), where our team analyzed wondr by BNI's digital banking engagement challenges and proposed the Three Dimensions Connected strategy.

## Overview
wondr Intelligence Engine is a decoupled, distributed full-stack system that automates the connection between three core financial dimensions in modern digital banking platforms:

*   **Transaction:** Records every payment, transfer, and bill. Status in current wondr: Active. Status in this engine: Active and Event Source.
*   **Insight:** Analyzes spending patterns and history. Status in current wondr: Manual, isolated. Status in this engine: Auto-triggered by ML.
*   **Growth:** Recommends investments and life goals. Status in current wondr: Manual, isolated. Status in this engine: Auto-triggered by Insight.

Instead of treating these as three separate features, this system couples them into a single automated, intelligent pipeline where every raw transaction stream automatically triggers ML inference and asynchronously dispatches personalized growth recommendations straight to the Next.js frontend interface.

## Architecture and Software Engineering Design
This project avoids monolithic anti-patterns by adhering to a Decoupled Distributed Architecture with clean software engineering principles:

```text
[ NEXT.JS CLIENT UI ]
        │
        │ (1) User triggers transaction (QRIS/Transfer/Bill Payment)
        │     via HTTP POST /transactions
        ▼
[ FASTAPI BACKEND SERVICES ]
        │
        │ (2) Instant write to database (ACID-compliant storage)
        │ (3) Returns immediate HTTP 200 OK to client (non-blocking user path)
        ▼
[ ASYNC BACKGROUND TASKS ] (Dispatched via FastAPI BackgroundTasks)
        │
        │ (4) Executes ML inference pipeline:
        │     K-Means -> Isolation Forest -> Prophet -> Rule Engine
        ▼
[ PERSISTENCE & ANALYTICS LAYER ]
        │
        │ (5) Updates application state in database
        │ (6) Next.js reactive frontend updates view dynamically via state injection
        ▼
[ NEXT.JS REACTIVE DASHBOARD ]
        │
        ├── Spending anomaly alert card
        ├── Life Goal progress update
        └── Growth recommendation prompt
```

### Design Patterns Applied
*   **Separation of Concerns:** Frontend UI and Backend Core Engine are completely decoupled and communicate strictly via secure RESTful APIs.
*   **Event-Driven Architecture:** Transactions act as business events that trigger downstream asynchronous ML processing.
*   **Async Background Processing:** ML inference is decoupled from the HTTP response cycle using native FastAPI BackgroundTasks, ensuring an instant, non-blocking user experience.
*   **Layered Repository Pattern:** Enforces clean separation between data access logic via SQLAlchemy ORM and the primary business domain logic.

## ML Pipeline
### Models Used
*   **K-Means Clustering:** Transaction categorization (food, transport, bills, lifestyle) using scikit-learn. Output: Spending category label.
*   **Isolation Forest:** Spending anomaly detection (unusual spikes) using scikit-learn. Output: Anomaly score and flag.
*   **Prophet:** Bill payment date forecasting (time-series) using Meta Prophet. Output: Next predicted payment date.
*   **Rule Engine:** Growth recommendation threshold logic via custom python class. Output: Recommendation trigger.

### Inference Flow
Raw Transaction Input -> Feature Extraction -> K-Means Clustering -> Isolation Forest -> Prophet Forecasting -> Rule Engine -> Insight and Recommendation Object Generated -> Stored to Persistence Layer -> Served to Frontend Interface.

### Example ML Output
```json
{
  "user_id": "usr_123",
  "generated_at": "2026-05-30T22:15:00Z",
  "insights": [
    {
      "type": "spending_anomaly",
      "category": "food_and_beverage",
      "message": "Coffee spending is 20% higher than last month",
      "current_amount": 420000,
      "baseline_amount": 350000,
      "anomaly_score": 0.83
    },
    {
      "type": "bill_forecast",
      "category": "utilities",
      "message": "Your electricity bill is predicted to arrive in 3 days",
      "predicted_date": "2026-06-02",
      "estimated_amount": 285000
    }
  ],
  "recommendations": [
    {
      "type": "life_goal_redirect",
      "source_category": "food_and_beverage",
      "redirect_amount": 100000,
      "target_goal": "Bali Trip",
      "impact": "Your goal is reached 2 weeks earlier",
      "confidence": 0.91
    }
  ]
}
```

## Tech Stack
*   **Frontend:** Next.js 14, TypeScript (strongly-typed financial models), Tailwind CSS, Tremor for interactive data visualization.
*   **Backend:** FastAPI (Python), Async-first, ML-native, high-performance REST API.
*   **Database:** SQLite for lightweight local prototyping. Note: For production deployment in a real fintech environment, PostgreSQL with connection pooling is strongly recommended.
*   **ML Frameworks:** scikit-learn and Meta Prophet for behavioral analytics.
*   **Containerization:** Docker and Docker Compose for environment-agnostic deployment.
*   **Testing:** Pytest and HTTPX for async backend integration tests.

## Project Structure
```text
wondr-intelligence-engine/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── routers/
│   │   ├── transactions.py      # POST /transactions endpoint
│   │   ├── insights.py          # GET /insights endpoint
│   │   └── recommendations.py   # GET /recommendations endpoint
│   ├── services/
│   │   ├── ml_pipeline.py       # ML inference orchestrator
│   │   ├── anomaly_detector.py  # Isolation Forest logic
│   │   ├── categorizer.py       # K-Means clustering logic
│   │   └── forecaster.py        # Prophet forecasting logic
│   ├── models/
│   │   ├── transaction.py       # SQLAlchemy transaction model
│   │   ├── insight.py           # SQLAlchemy insight model
│   │   └── recommendation.py    # SQLAlchemy recommendation model
│   ├── database.py              # DB connection & session management
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main interactive dashboard UI
│   │   ├── transactions/        # Transaction simulator interface
│   │   └── insights/            # Reactive insight & recommendation modules
│   ├── components/
│   │   ├── TransactionCard.tsx
│   │   ├── InsightAlert.tsx
│   │   └── GrowthRecommendation.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Getting Started
### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   Docker & Docker Compose (Optional)

### Run with Docker (Recommended)
```bash
git clone [https://github.com/yourusername/wondr-intelligence-engine](https://github.com/yourusername/wondr-intelligence-engine)
cd wondr-intelligence-engine
docker-compose up --build
```

### Run Manually
Run Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Run Frontend (Separate Terminal):
```bash
cd frontend
npm install
npm run dev
```

## Key Endpoints
*   `POST /transactions`: Submit a new transaction, triggers background ML pipeline.
*   `GET /insights/{user_id}`: Retrieve processed insights for a specific user.
*   `GET /recommendations/{user_id}`: Retrieve growth recommendations for a specific user.
*   `GET /users/{user_id}/summary`: Complete financial summary metrics across all three dimensions.

## Roadmap
*   [x] Core transaction ingestion API design.
*   [x] Non-blocking async ML inference pipeline architecture.
*   [x] Spending anomaly detection model implementation (Isolation Forest).
*   [x] Spending categorization model implementation (K-Means).
*   [ ] Bill payment forecasting integration (Prophet).
*   [ ] Growth recommendation rule engine completion.
*   [ ] Next.js high-fidelity dashboard integration.
*   [ ] PostgreSQL migration layer for production readiness.

## Context and Inspiration
This project is a technical implementation inspired by real-world digital banking challenges analyzed at GMBCC 2026 (Gadjah Mada Business Case Competition, 20th Edition), where our team proposed the Three Dimensions Connected strategy as a solution to wondr by BNI's user engagement gap.

The core business insight that drove this technical implementation:
"wondr by BNI's Transaction, Insight, and Growth dimensions operate as isolated modules. No automated connection exists between them, leaving 46% of 13.5 million registered users passive and underengaged. ML-powered behavioral analysis can bridge this gap, transforming every transaction into a step toward the user's larger financial goals."

## License
MIT License. Free to use, modify, and distribute. Built with curiosity and a strong commitment to clean architecture.