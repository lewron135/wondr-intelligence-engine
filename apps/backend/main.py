from fastapi import FastAPI
from database import engine, Base

# 1. Import semua ORM Models demi kelancaran metadata database
from models.transaction import Transaction
from models.insight import Insight
from models.recommendation import GrowthRecommendation
from models.portfolio import UserPortfolio, PortfolioHolding  # noqa: F401

# 2. Import semua Routers yang baru saja kita buat
from routers import transaction, insight, recommendation, users
from routers import market
from routers import portfolio

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="wondr Intelligence Engine",
    description="ML-Powered Distributed Backend for Personalized Digital Banking",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)

# 3. Daftarkan router ke instance FastAPI utama
app.include_router(transaction.router)
app.include_router(insight.router)
app.include_router(recommendation.router)
app.include_router(users.router)
app.include_router(market.router)
app.include_router(portfolio.router)

@app.get("/")
def read_root():
    return {
        "status": "active",
        "message": "wondr Intelligence Engine Backend API is running smoothly"
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Mengizinkan semua domain (termasuk Flutter localhost nanti)
    allow_credentials=True,
    allow_methods=["*"],  # Mengizinkan semua HTTP Methods (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # Mengizinkan semua HTTP Headers
)