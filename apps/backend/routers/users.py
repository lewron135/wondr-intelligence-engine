from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.transaction import Transaction
from models.insight import Insight
from models.recommendation import GrowthRecommendation

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/{user_id}/summary")
def get_user_summary(user_id: str, db: Session = Depends(get_db)):
    transactions = db.query(Transaction).filter(Transaction.user_id == user_id).all()
    insights = db.query(Insight).filter(Insight.user_id == user_id).all()
    recommendations = db.query(GrowthRecommendation).filter(
        GrowthRecommendation.user_id == user_id
    ).all()

    # --- Transaction Dimension ---
    total_spent = sum(t.amount for t in transactions)
    spending_by_category: dict[str, float] = {}
    for t in transactions:
        spending_by_category[t.category] = spending_by_category.get(t.category, 0.0) + t.amount

    latest = transactions[-1] if transactions else None

    # --- Insight Dimension ---
    anomaly_insights = [i for i in insights if i.type == "spending_anomaly"]
    bill_forecasts = [i for i in insights if i.type == "bill_forecast"]

    # --- Growth Dimension ---
    total_redirect_recommended = sum(
        r.recommended_redirect_amount or 0.0 for r in recommendations
    )

    return {
        "user_id": user_id,
        "summary": {
            "transaction_dimension": {
                "total_transactions": len(transactions),
                "total_spent": total_spent,
                "spending_by_category": spending_by_category,
                "latest_transaction": {
                    "merchant": latest.merchant_name,
                    "amount": latest.amount,
                    "category": latest.category,
                    "timestamp": latest.timestamp,
                } if latest else None,
            },
            "insight_dimension": {
                "total_insights_generated": len(insights),
                "anomalies_detected": len(anomaly_insights),
                "has_active_anomaly": len(anomaly_insights) > 0,
                "bill_forecasts": [
                    {
                        "category": f.category,
                        "message": f.message,
                        "predicted_date": f.predicted_date,
                    }
                    for f in bill_forecasts
                ],
            },
            "growth_dimension": {
                "total_recommendations": len(recommendations),
                "total_redirect_recommended": total_redirect_recommended,
                "active_goals": [
                    {
                        "target_goal": r.target_goal,
                        "current_balance": r.current_balance,
                        "target_amount": r.target_amount,
                        "recommended_redirect_amount": r.recommended_redirect_amount,
                        "impact_message": r.impact_message,
                        "progress_pct": (
                            round((r.current_balance / r.target_amount) * 100, 1)
                            if r.target_amount
                            else 0.0
                        ),
                    }
                    for r in recommendations
                ],
            },
        },
    }
