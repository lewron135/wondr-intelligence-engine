from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models.transaction import Transaction
from pydantic import BaseModel
from services.anomaly_detector import AnomalyDetectorService
# 1. IMPORT SERVICE PROPHET BARU LU
from services.bill_forecaster import BillForecasterService

router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"]
)

class TransactionCreate(BaseModel):
    user_id: str
    amount: float
    category: str
    merchant_name: str

@router.post("/")
def create_transaction(
    transaction: TransactionCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # Simpan transaksi ke SQLite
    db_transaction = Transaction(
        user_id=transaction.user_id,
        amount=transaction.amount,
        category=transaction.category,
        merchant_name=transaction.merchant_name
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    # 2. Picu Anomaly Detector (Jalan terus untuk semua kategori)
    background_tasks.add_task(
        AnomalyDetectorService.analyze_user_spending, 
        transaction.user_id, 
        db
    )
    
    # 3. JIKA KATEGORINYA ADALAH TAGIHAN, Picu Pipa Peramalan Prophet secara Async!
    if transaction.category in ['bills', 'utilities']:
        background_tasks.add_task(
            BillForecasterService.forecast_upcoming_bills,
            transaction.user_id,
            db
        )
    
    return {
        "status": "success",
        "message": "Transaction recorded. AI Intelligence pipelines triggered in background.",
        "data": {
            "id": db_transaction.id,
            "user_id": db_transaction.user_id,
            "amount": db_transaction.amount,
            "category": transaction.category,
            "merchant_name": db_transaction.merchant_name,
            "timestamp": db_transaction.timestamp
        }
    }