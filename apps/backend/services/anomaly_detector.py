import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from models.transaction import Transaction
from models.insight import Insight
from models.recommendation import GrowthRecommendation

class AnomalyDetectorService:
    @staticmethod
    def analyze_user_spending(user_id: str, db: Session):
        # 1. Ambil semua histori transaksi user ini dari database SQLite
        transactions = db.query(Transaction).filter(Transaction.user_id == user_id).all()
        
        # Bisnis logik keamanan: Model ML butuh minimal data buat belajar.
        # Kalau transaksi kurang dari 3, kita skip dulu biar gak ngaco statistiknya.
        if len(transactions) < 3:
            return None

        # 2. Convert data transaksi dari DB menjadi Pandas DataFrame agar bisa dibaca Scikit-Learn
        data = [{
            "id": t.id,
            "amount": t.amount,
            "category": t.category,
            "merchant_name": t.merchant_name
        } for t in transactions]
        
        df = pd.DataFrame(data)

        # 3. Inisialisasi & Fit Model Isolation Forest
        # contamination=0.15 artinya kita memprediksi sekitar 15% dari total transaksi adalah anomali (bocor)
        model = IsolationForest(contamination=0.15, random_state=42)
        
        # Kita latih model berdasarkan fitur 'amount' (nominal uang)
        df['anomaly_score'] = model.fit_predict(df[['amount']])
        
        # Catatan Isolation Forest: 
        # Score  1 = Transaksi Normal / Wajar
        # Score -1 = Transaksi Anomali / Lonjakan Pengeluaran (Outlier)
        anomalies = df[df['anomaly_score'] == -1]

        # 4. Jika ditemukan transaksi anomali, buatkan Insight dan Growth Recommendation secara otomatis
        if not anomalies.empty:
            # Ambil transaksi anomali yang paling parah nominalnya
            worst_anomaly = anomalies.sort_values(by='amount', ascending=False).iloc[0]
            
            # Cek apakah insight serupa sudah pernah dibuat biar gak duplikat di DB
            existing_insight = db.query(Insight).filter(
                Insight.user_id == user_id, 
                Insight.category == worst_anomaly['category']
            ).first()

            if not existing_insight:
                # Bikin pesan narasi humanis ala aplikasi perbankan modern
                msg = f"Waduh! Pengeluaran kamu di kategori {worst_anomaly['category']} melonjak tajam nih. Terakhir tercatat Rp {worst_anomaly['amount']:,} di {worst_anomaly['merchant_name']}."
                
                # Masukkan ke tabel Insights
                new_insight = Insight(
                    user_id=user_id,
                    type="spending_anomaly",
                    category=worst_anomaly['category'],
                    message=msg,
                    anomaly_score=float(worst_anomaly['amount'])
                )
                db.add(new_insight)

                # Pasangkan dengan Rule Engine sederhana untuk dimensi Growth!
                # Kita sarankan user menghemat dan mengalihkan 20% dari dana bocor itu ke investasi goal-nya
                redirect_target = float(worst_anomaly['amount'] * 0.20)
                
                new_growth = GrowthRecommendation(
                    user_id=user_id,
                    target_goal="Tabungan Masa Depan",
                    current_balance=50000.0, # saldo dummy awal investasi
                    target_amount=1000000.0,
                    recommended_redirect_amount=redirect_target,
                    impact_message=f"Bocoran dana terdeteksi! Kalau kamu amankan Rp {redirect_target:,} dari pos {worst_anomaly['category']} ini ke investasi, impian finansialmu bisa tercapai lebih cepat!"
                )
                db.add(new_growth)
                
                db.commit()
                return {"status": "analyzed", "anomaly_found": True, "merchant": worst_anomaly['merchant_name']}
                
        return {"status": "analyzed", "anomaly_found": False}