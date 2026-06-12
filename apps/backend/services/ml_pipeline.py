from sqlalchemy.orm import Session

from models.transaction import Transaction
from services.anomaly_detector import AnomalyDetectorService
from services.bill_forecaster import BillForecasterService
from services.recommendation import RecommendationService


class MLPipelineOrchestrator:
    @staticmethod
    def run_pipeline(user_id: str, transaction_id: int, db: Session):
        """
        Sequential ML inference pipeline triggered by every new transaction.

        Stage 1 — Isolation Forest: detects anomalous spending patterns.
        Stage 2 — Prophet: forecasts upcoming bill dates (bills/utilities only).
        Stage 3 — Rule Engine: synthesizes insights into GrowthRecommendation records.
        """
        AnomalyDetectorService.analyze_user_spending(user_id, db)

        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if transaction and transaction.category in ("bills", "utilities"):
            BillForecasterService.forecast_upcoming_bills(user_id, db)

        RecommendationService.generate_recommendations(user_id, db)
