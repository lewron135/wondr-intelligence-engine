from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base

class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False) # 'spending_anomaly' atau 'bill_forecast'
    category = Column(String, nullable=False)
    message = Column(String, nullable=False) # Narasi text buat dilempar ke Next.js
    anomaly_score = Column(Float, nullable=True) # Score dari Isolation Forest
    predicted_date = Column(String, nullable=True) # Prediksi tanggal dari Prophet
    created_at = Column(DateTime(timezone=True), server_default=func.now())