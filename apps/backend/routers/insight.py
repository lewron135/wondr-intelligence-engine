from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.insight import Insight

router = APIRouter(prefix="/insights", tags=["Insights"])


@router.get("/{user_id}")
def get_user_insights(user_id: str, db: Session = Depends(get_db)):
    insights = db.query(Insight).filter(Insight.user_id == user_id).all()

    if not insights:
        return {
            "user_id": user_id,
            "insights": [
                {
                    "type": "system_status",
                    "category": "general",
                    "message": (
                        "Intelligence Engine sedang mengumpulkan data transaksi kamu. "
                        "Belum ada anomali terdeteksi."
                    ),
                    "anomaly_score": 0.0,
                }
            ],
        }

    return {"user_id": user_id, "insights": insights}
