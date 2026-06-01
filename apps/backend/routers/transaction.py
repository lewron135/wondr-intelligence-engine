from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models.transaction import Transaction
from pydantic import BaseModel
# IMPORT SERVICE ML YANG BARUSAN KITA BIKIN
from services.anomaly_detector import AnomalyDetectorService

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
    background_tasks: BackgroundTasks, # Kita panggil fitur BackgroundTasks bawaan FastAPI
    db: Session = Depends(get_db)
):
    # 1. Simpan transaksi baru ke SQLite
    db_transaction = Transaction(
        user_id=transaction.user_id,
        amount=transaction.amount,
        category=transaction.category,
        merchant_name=transaction.merchant_name
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    # 2. FITUR SE SAKTI: Picu model ML Isolation Forest untuk jalan di latar belakang (Async)
    # Browser / Next.js gak bakal nungguin proses hitung ML-nya selesai, jadi aplikasi tetep kerasa instan!
    background_tasks.add_task(
        AnomalyDetectorService.analyze_user_spending, 
        transaction.user_id, 
        db
    )
    
    return {
        "status": "success",
        "message": "Transaction recorded. ML Intelligence pipeline triggered in background.",
        "data": {
            "id": db_transaction.id,
            "user_id": db_transaction.user_id,
            "amount": db_transaction.amount,
            "category": db_transaction.category,
            "merchant_name": db_transaction.merchant_name,
            "timestamp": db_transaction.timestamp
        }
    }  