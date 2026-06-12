from collections import Counter
from datetime import datetime, timedelta

import pandas as pd
from prophet import Prophet
from sqlalchemy.orm import Session

from models.insight import Insight
from models.transaction import Transaction


def _fmt_rupiah(amount: float) -> str:
    """Format as Indonesian Rupiah: Rp 1.500.000"""
    return "Rp " + f"{int(amount):,}".replace(",", ".")


_ID_MONTHS = {
    "January": "Januari", "February": "Februari", "March": "Maret",
    "April": "April",     "May": "Mei",            "June": "Juni",
    "July": "Juli",       "August": "Agustus",     "September": "September",
    "October": "Oktober", "November": "November",  "December": "Desember",
}

_CATEGORY_LABEL = {
    "bills":     "tagihan rutin",
    "utilities": "utilitas (listrik/internet/air)",
}

# Per-category closing nudge
_CATEGORY_NUDGE = {
    "bills":     "Jangan sampai telat bayar dan kena denda ya — sisihkan sekarang!",
    "utilities": "Segera set auto-debit biar gak kecolongan telat bayar bulan depan!",
}


def _to_id_date(dt_str: str) -> str:
    """Convert English date string '15 June 2026' → '15 Juni 2026'."""
    for en, id_ in _ID_MONTHS.items():
        dt_str = dt_str.replace(en, id_)
    return dt_str


class BillForecasterService:
    @staticmethod
    def forecast_upcoming_bills(user_id: str, db: Session):
        transactions = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.category.in_(["bills", "utilities"]),
            )
            .all()
        )
        print(
            f"\n=== [DEBUG PROPHET] User ID: {user_id} | "
            f"Total transaksi bills ditemukan: {len(transactions)} ==="
        )

        # Prophet needs at least 5 time-series data points for a reliable forecast.
        if len(transactions) < 5:
            print("=== [DEBUG PROPHET] Transaksi kurang dari 5, aborting forecast. ===")
            return None

        # Determine the dominant category for contextual copywriting.
        dominant_category = Counter(t.category for t in transactions).most_common(1)[0][0]

        # Assign synthetic monthly dates so Prophet can detect recurring billing cycles.
        n = len(transactions)
        base_date = datetime.now()
        data = [
            {
                "ds": (base_date - timedelta(days=(n - 1 - i) * 30)).strftime("%Y-%m-%d"),
                "y": t.amount,
            }
            for i, t in enumerate(transactions)
        ]

        df = pd.DataFrame(data)
        df["ds"] = pd.to_datetime(df["ds"])

        print(
            "=== [DEBUG PROPHET] DataFrame berhasil dibentuk. "
            "Mulai training model Prophet... ==="
        )
        model = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
        )
        model.fit(df)

        future = model.make_future_dataframe(periods=30)
        forecast = model.predict(future)

        latest = forecast.iloc[-1]
        predicted_date   = _to_id_date(latest["ds"].strftime("%d %B %Y"))
        predicted_amount = max(0.0, float(latest["yhat"]))
        print(
            f"=== [DEBUG PROPHET] Training selesai. "
            f"Prediksi: {predicted_date}, Nominal: {predicted_amount} ==="
        )

        cat_label = _CATEGORY_LABEL.get(dominant_category, "tagihan rutin")
        nudge     = _CATEGORY_NUDGE.get(dominant_category, "Sisihkan dananya dari sekarang ya!")

        msg = (
            f"📅 Siap-siap! Tagihan {cat_label} kamu "
            f"(sekitar {_fmt_rupiah(predicted_amount)}) "
            f"diprediksi akan jatuh tempo pada {predicted_date}. {nudge}"
        )

        existing = (
            db.query(Insight)
            .filter(Insight.user_id == user_id, Insight.type == "bill_forecast")
            .first()
        )

        if existing:
            existing.message        = msg
            existing.predicted_date = predicted_date
        else:
            db.add(
                Insight(
                    user_id=user_id,
                    type="bill_forecast",
                    category=dominant_category,
                    message=msg,
                    predicted_date=predicted_date,
                )
            )

        db.commit()
        print("=== [DEBUG PROPHET] Berhasil commit insight ke database! ===\n")
        return {
            "status": "forecasted",
            "predicted_date": predicted_date,
            "amount": predicted_amount,
        }
