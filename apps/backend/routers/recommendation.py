from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.recommendation import GrowthRecommendation

router = APIRouter(
    prefix="/recommendations",
    tags=["Growth Recommendations"]
)

@router.get("/{user_id}")
def get_user_recommendations(user_id: str, db: Session = Depends(get_db)):
    recommendations = db.query(GrowthRecommendation).filter(GrowthRecommendation.user_id == user_id).all()
    
    if not recommendations:
        return {
            "user_id": user_id,
            "recommendations": [
                {
                    "target_goal": "Tabungan Masa Depan",
                    "current_balance": 0.0,
                    "target_amount": 1000000.0,
                    "recommended_redirect_amount": 0.0,
                    "impact_message": "Yuk mulai set target finansialmu di aplikasi wondr!"
                }
            ]
        }
        
    return {
        "user_id": user_id,
        "recommendations": recommendations
    }