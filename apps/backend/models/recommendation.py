from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base

class GrowthRecommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=False)
    target_goal = Column(String, nullable=False) # Contoh: 'Liburan Bali'
    current_balance = Column(Float, default=0.0)
    target_amount = Column(Float, nullable=False)
    recommended_redirect_amount = Column(Float, nullable=True) # Nominal pemotongan dana bocor
    impact_message = Column(String, nullable=True) # Motivasi efek masa depan
    created_at = Column(DateTime(timezone=True), server_default=func.now())