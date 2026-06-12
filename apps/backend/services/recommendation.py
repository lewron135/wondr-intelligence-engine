import re
from sqlalchemy.orm import Session

from models.insight import Insight
from models.recommendation import GrowthRecommendation


def _fmt_rupiah(amount: float) -> str:
    """Format as Indonesian Rupiah: Rp 1.500.000"""
    return "Rp " + f"{int(amount):,}".replace(",", ".")


_CATEGORY_LABELS: dict[str, str] = {
    "food_and_beverage":   "makan & minum",
    "groceries":           "belanja kebutuhan dapur",
    "shopping":            "belanja online/offline",
    "transfer_investment": "transfer & pembayaran",
    "transport":           "transportasi",
    "utilities":           "tagihan utilitas",
    "lifestyle":           "hiburan & lifestyle",
    "healthcare":          "kesehatan",
    "travel":              "travel & wisata",
    "uncategorized":       "pengeluaran tak terduga",
}

# source_category → (goal name, target amount, motivational hook)
_GOAL_MAP: dict[str, tuple[str, float, str]] = {
    "shopping": (
        "Dana Darurat",
        10_000_000.0,
        "biar tenang kalau ada kejadian tak terduga — safety net itu non-negotiable",
    ),
    "lifestyle": (
        "Dana Darurat",
        10_000_000.0,
        "safety net lebih penting dari hiburan sesaat — invest dulu untuk ketenangan pikiran",
    ),
    "food_and_beverage": (
        "Investasi Reksadana",
        5_000_000.0,
        "biar uang kamu ikut bekerja, bukan cuma perut yang kenyang",
    ),
    "groceries": (
        "Dana Darurat",
        10_000_000.0,
        "fondasi keuangan sehat dimulai dari disiplin pengeluaran harian",
    ),
    "transport": (
        "Liburan ke Bali",
        8_000_000.0,
        "ongkos segitu mending buat liburan yang beneran berkesan dan terencana",
    ),
    "utilities": (
        "Upgrade Gadget",
        5_000_000.0,
        "hemat tagihan sekarang, invest buat produktivitas yang lebih tinggi besok",
    ),
    "healthcare": (
        "Asuransi Kesehatan",
        3_600_000.0,
        "bayar premi itu jauh lebih murah dibanding bayar tagihan rumah sakit",
    ),
    "travel": (
        "Dana Darurat",
        10_000_000.0,
        "setelah liburan seru, kamu tetap butuh bantalan finansial yang kuat",
    ),
    "transfer_investment": (
        "Portofolio Saham",
        20_000_000.0,
        "kalau sudah vibe transfer, mending ke instrumen yang beneran tumbuh",
    ),
    "uncategorized": (
        "Dana Darurat",
        10_000_000.0,
        "pengeluaran tak terduga adalah alasan utama kenapa kamu butuh dana cadangan",
    ),
}
_DEFAULT_GOAL: tuple[str, float, str] = (
    "Dana Darurat",
    10_000_000.0,
    "pondasi finansial yang kuat selalu butuh safety net yang solid",
)


class RecommendationService:
    REDIRECT_RATIO = 0.20   # redirect 20% of detected leaked spend
    MIN_REDIRECT   = 50_000.0

    @staticmethod
    def generate_recommendations(user_id: str, db: Session):
        insights = db.query(Insight).filter(Insight.user_id == user_id).all()

        anomaly_insights = [i for i in insights if i.type == "spending_anomaly"]
        bill_forecast    = next((i for i in insights if i.type == "bill_forecast"), None)

        if not anomaly_insights and not bill_forecast:
            return

        # Determine the primary source category to pick a contextual goal.
        primary_category = anomaly_insights[0].category if anomaly_insights else "uncategorized"

        # anomaly_score stores the anomalous transaction amount.
        leaked_amount = sum(
            i.anomaly_score for i in anomaly_insights
            if i.anomaly_score and i.anomaly_score > 0
        )

        # Fallback: derive leaked amount from the bill forecast message text.
        if leaked_amount <= 0 and bill_forecast:
            match = re.search(r"Rp\s*([\d.,]+)", bill_forecast.message)
            if match:
                raw = match.group(1).replace(".", "").replace(",", "")
                leaked_amount = float(raw)

        redirect_amount = leaked_amount * RecommendationService.REDIRECT_RATIO

        if redirect_amount < RecommendationService.MIN_REDIRECT:
            return

        goal_name, goal_target, hook = _GOAL_MAP.get(primary_category, _DEFAULT_GOAL)
        cat_label = _CATEGORY_LABELS.get(primary_category, "pengeluaran tak perlu")

        existing = (
            db.query(GrowthRecommendation)
            .filter(
                GrowthRecommendation.user_id == user_id,
                GrowthRecommendation.target_goal == goal_name,
            )
            .first()
        )

        current_balance = existing.current_balance if existing else 0.0
        target_amount   = existing.target_amount if existing else goal_target
        remaining       = max(0.0, target_amount - current_balance)
        months          = round(remaining / redirect_amount) if redirect_amount > 0 else 0

        months_str = (
            f"dalam ~{months} bulan" if months > 0
            else "lebih cepat dari yang kamu bayangkan"
        )

        impact_msg = (
            f"Daripada bocor {_fmt_rupiah(redirect_amount)} buat {cat_label}, "
            f"mending dialokasikan buat target '{goal_name}' kamu — {hook}. "
            f"Kalau konsisten setiap bulan, target {_fmt_rupiah(target_amount)} "
            f"bisa kamu raih {months_str}! 💪"
        )

        if existing:
            existing.recommended_redirect_amount = redirect_amount
            existing.impact_message = impact_msg
        else:
            db.add(
                GrowthRecommendation(
                    user_id=user_id,
                    target_goal=goal_name,
                    current_balance=0.0,
                    target_amount=target_amount,
                    recommended_redirect_amount=redirect_amount,
                    impact_message=impact_msg,
                )
            )

        db.commit()
