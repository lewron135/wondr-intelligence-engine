from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models.portfolio import PortfolioHolding, UserPortfolio

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


# ─── Pydantic schemas ──────────────────────────────────────────────────────

class HoldingBody(BaseModel):
    symbol: str
    average_price: float = Field(..., gt=0)
    quantity: float = Field(..., gt=0)


class CashBody(BaseModel):
    cash_balance: float = Field(..., ge=0)


# ─── Helpers ───────────────────────────────────────────────────────────────

def _get_or_create_portfolio(user_id: str, db: Session) -> UserPortfolio:
    portfolio = (
        db.query(UserPortfolio)
        .filter(UserPortfolio.user_id == user_id)
        .first()
    )
    if not portfolio:
        portfolio = UserPortfolio(user_id=user_id, cash_balance=0.0)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    return portfolio


def _holding_dict(h: PortfolioHolding) -> dict:
    return {
        "id": h.id,
        "symbol": h.symbol,
        "average_price": h.average_price,
        "quantity": h.quantity,
    }


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/{user_id}")
def get_portfolio(user_id: str, db: Session = Depends(get_db)):
    portfolio = _get_or_create_portfolio(user_id, db)
    holdings = (
        db.query(PortfolioHolding)
        .filter(PortfolioHolding.user_id == user_id)
        .all()
    )
    return {
        "user_id": user_id,
        "cash_balance": portfolio.cash_balance,
        "holdings": [_holding_dict(h) for h in holdings],
    }


@router.post("/{user_id}/holdings", status_code=200)
def upsert_holding(
    user_id: str, body: HoldingBody, db: Session = Depends(get_db)
):
    existing = (
        db.query(PortfolioHolding)
        .filter(
            PortfolioHolding.user_id == user_id,
            PortfolioHolding.symbol == body.symbol,
        )
        .first()
    )
    if existing:
        existing.average_price = body.average_price
        existing.quantity = body.quantity
        db.commit()
        db.refresh(existing)
        return {"action": "updated", "holding": _holding_dict(existing)}

    new_h = PortfolioHolding(
        user_id=user_id,
        symbol=body.symbol,
        average_price=body.average_price,
        quantity=body.quantity,
    )
    db.add(new_h)
    db.commit()
    db.refresh(new_h)
    return {"action": "created", "holding": _holding_dict(new_h)}


@router.delete("/{user_id}/holdings/{symbol:path}")
def delete_holding(
    user_id: str, symbol: str, db: Session = Depends(get_db)
):
    holding = (
        db.query(PortfolioHolding)
        .filter(
            PortfolioHolding.user_id == user_id,
            PortfolioHolding.symbol == symbol,
        )
        .first()
    )
    if not holding:
        raise HTTPException(status_code=404, detail=f"Holding '{symbol}' not found")
    db.delete(holding)
    db.commit()
    return {"action": "deleted", "symbol": symbol}


@router.put("/{user_id}/cash")
def update_cash(
    user_id: str, body: CashBody, db: Session = Depends(get_db)
):
    portfolio = _get_or_create_portfolio(user_id, db)
    portfolio.cash_balance = body.cash_balance
    db.commit()
    db.refresh(portfolio)
    return {"user_id": user_id, "cash_balance": portfolio.cash_balance}
