import re
from sqlalchemy.orm import Session
from models.insight import Insight


class RecommendationService:
    @staticmethod
    def generate_recommendations(user_id: str, db: Session):
        insights = db.query(Insight).filter(Insight.user_id == user_id).all()

        has_spending_anomaly = any(i.type == "spending_anomaly" for i in insights)
        bill_forecast = next((i for i in insights if i.type == "bill_forecast"), None)

        if not bill_forecast:
            return

        # Ekstrak nominal dari pesan forecast menggunakan regex
        match = re.search(r"Rp ([\d,.]+)", bill_forecast.message)
        if not match:
            return

        amount_str = match.group(1).replace(",", "").replace(".", "")
        predicted_amount = float(amount_str)

        # Buat saving_tip hanya jika forecast > 150.000 atau ada spending_anomaly (tren naik)
        if predicted_amount <= 150_000 and not has_spending_anomaly:
            return

        msg = (
            f"Prediksi tagihan kamu bulan depan mencapai Rp {predicted_amount:,.0f}. "
            "Yuk, mulai hemat dengan mematikan perangkat elektronik yang tidak dipakai "
            "atau atur timer AC tidur agar tagihan berkurang!"
        )

        existing_tip = db.query(Insight).filter(
            Insight.user_id == user_id,
            Insight.type == "saving_tip"
        ).first()

        if existing_tip:
            existing_tip.message = msg
        else:
            db.add(Insight(
                user_id=user_id,
                type="saving_tip",
                category="bills",
                message=msg,
            ))

        db.commit()
