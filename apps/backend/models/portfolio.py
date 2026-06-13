from sqlalchemy import Column, Integer, String, Float, UniqueConstraint
from database import Base


class UserPortfolio(Base):
    """Stores per-user cash balance (buying power)."""
    __tablename__ = "user_portfolios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    cash_balance = Column(Float, default=0.0, nullable=False)


class PortfolioHolding(Base):
    """One row per (user_id, symbol) pair. Upserted on save."""
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=False)
    symbol = Column(String, nullable=False)
    average_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "symbol", name="uq_portfolio_user_symbol"),
    )
