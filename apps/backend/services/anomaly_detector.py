import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from models.transaction import Transaction
from models.insight import Insight


def _fmt_rupiah(amount: float) -> str:
    """Format as Indonesian Rupiah: Rp 1.500.000"""
    return "Rp " + f"{int(amount):,}".replace(",", ".")


# Per-category: (label used in sentence, punchy closing nudge)
_CATEGORY_COPY: dict[str, tuple[str, str]] = {
    "food_and_beverage": (
        "makan & minum",
        "Kalap kuliner bisa bikin kantong jebol pelan-pelan — kendalikan sebelum makin bocor!",
    ),
    "groceries": (
        "belanja kebutuhan dapur",
        "Beli sesuai list, jangan tergoda lorong diskon — hati-hati bocor halus!",
    ),
    "shopping": (
        "belanja online/offline",
        "Flash sale itu jebakan batman — hati-hati bocor halus minggu ini!",
    ),
    "transfer_investment": (
        "transfer & pembayaran",
        "Pastikan setiap rupiah betul-betul dikirim ke tempat yang produktif ya!",
    ),
    "transport": (
        "transportasi",
        "Ongkos segitu besar — pertimbangkan alternatif yang lebih hemat sebelum makin nguras!",
    ),
    "utilities": (
        "tagihan utilitas",
        "Cek ulang paket internet & listrikmu — mungkin ada yang bisa dipangkas bulan ini!",
    ),
    "lifestyle": (
        "hiburan & lifestyle",
        "Hiburan oke, tapi jangan sampai ngalahin target nabungmu — prioritas dulu!",
    ),
    "healthcare": (
        "kesehatan",
        "Kesehatan nomor satu, tapi tetap pantau angkanya biar gak kaget di akhir bulan!",
    ),
    "travel": (
        "travel & wisata",
        "Liburan impian boleh, asal sudah dianggarkan dari awal — bukan impulsif!",
    ),
    "uncategorized": (
        "tak terduga",
        "Ada pengeluaran di luar kebiasaan yang perlu kamu cermatin lebih lanjut!",
    ),
}
_DEFAULT_COPY = ("pengeluaran", "Hati-hati bocor halus minggu ini!")


class AnomalyDetectorService:
    @staticmethod
    def analyze_user_spending(user_id: str, db: Session):
        transactions = (
            db.query(Transaction).filter(Transaction.user_id == user_id).all()
        )

        # IsolationForest needs at least 3 data points to produce meaningful scores.
        if len(transactions) < 3:
            return None

        data = [
            {
                "id": t.id,
                "amount": t.amount,
                "category": t.category,
                "merchant_name": t.merchant_name,
            }
            for t in transactions
        ]
        df = pd.DataFrame(data)

        # contamination=0.15 → we expect ~15% of transactions to be outliers.
        model = IsolationForest(contamination=0.15, random_state=42)
        df["anomaly_score"] = model.fit_predict(df[["amount"]])
        # IsolationForest: 1 = normal, -1 = anomaly (outlier / spending spike)
        anomalies = df[df["anomaly_score"] == -1]

        if not anomalies.empty:
            normal_df = df[df["anomaly_score"] == 1]
            normal_mean = normal_df["amount"].mean() if not normal_df.empty else None
            anomaly_count = len(anomalies)
            worst = anomalies.sort_values(by="amount", ascending=False).iloc[0]

            existing = (
                db.query(Insight)
                .filter(
                    Insight.user_id == user_id,
                    Insight.category == worst["category"],
                )
                .first()
            )

            if not existing:
                label, nudge = _CATEGORY_COPY.get(worst["category"], _DEFAULT_COPY)

                # Build "X× lebih besar dari rata-rata" suffix when ratio is meaningful.
                ratio_str = ""
                if normal_mean and normal_mean > 0:
                    ratio = worst["amount"] / normal_mean
                    if ratio >= 1.5:
                        ratio_str = f" — {ratio:.1f}× lebih besar dari rata-ratamu"

                count_str = (
                    f" ({anomaly_count} transaksi mencurigakan terdeteksi bulan ini)"
                    if anomaly_count > 1
                    else ""
                )

                msg = (
                    f"⚠️ Pengeluaran {label} kamu melonjak tajam hingga "
                    f"{_fmt_rupiah(worst['amount'])}{ratio_str}! "
                    f"Transaksi di '{worst['merchant_name']}' terdeteksi sebagai "
                    f"anomali{count_str}. {nudge}"
                )

                db.add(
                    Insight(
                        user_id=user_id,
                        type="spending_anomaly",
                        category=worst["category"],
                        message=msg,
                        anomaly_score=float(worst["amount"]),
                    )
                )
                db.commit()
                return {
                    "status": "analyzed",
                    "anomaly_found": True,
                    "merchant": worst["merchant_name"],
                }

        return {"status": "analyzed", "anomaly_found": False}
