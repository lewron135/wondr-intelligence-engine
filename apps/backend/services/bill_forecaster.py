import pandas as pd
from prophet import Prophet
from sqlalchemy.orm import Session
from models.transaction import Transaction
from models.insight import Insight
from datetime import datetime, timedelta

class BillForecasterService:
    @staticmethod
    def forecast_upcoming_bills(user_id: str, db: Session):
        # 1. Ambil semua histori transaksi user khusus untuk kategori tagihan/utilitas
        # Kita filter berdasarkan kategori 'bills' atau 'utilities'
        transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.category.in_(['bills', 'utilities'])
        ).all()
        print(f"\n=== [DEBUG PROPHET] User ID: {user_id} | Total transaksi bills ditemukan: {len(transactions)} ===")

        # Prophet secara statistik butuh data time-series yang cukup (minimal 5 transaksi)
        # supaya ramalannya akurat dan gak ngaco.
        if len(transactions) < 5:
            print("=== [DEBUG PROPHET] Transaksi kurang dari 5, aborting forecast. ===")
            return None

        # 2. Format data sesuai standar mutlak Prophet: Kolom 'ds' (datestamp) dan 'y' (numeric value)
        # Simulasi tanggal mundur otomatis: setiap transaksi diberi jarak mundur 30 hari
        # berdasarkan urutan indeks agar Prophet bisa mendeteksi tren musiman bulanan.
        # Transaksi terakhir (indeks n-1) → hari ini, indeks sebelumnya → 30 hari lebih awal, dst.
        n = len(transactions)
        base_date = datetime.now()
        data = [{
            "ds": (base_date - timedelta(days=(n - 1 - i) * 30)).strftime('%Y-%m-%d'),
            "y": t.amount
        } for i, t in enumerate(transactions)]

        df = pd.DataFrame(data)
        df['ds'] = pd.to_datetime(df['ds'])

        # 3. Inisialisasi & Training Model Prophet
        # Kita matikan yearly/weekly seasonality karena data lokal kita masih berskala kecil
        print("=== [DEBUG PROPHET] DataFrame berhasil dibentuk. Mulai training model Prophet... ===")
        model = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
        model.fit(df)

        # 4. Buat tempat masa depan (future dataframe) untuk 30 hari ke depan
        future = model.make_future_dataframe(periods=30)
        forecast = model.predict(future)

        # 5. Ambil hasil prediksi baris terakhir (paling depan di masa depan)
        latest_forecast = forecast.iloc[-1]
        predicted_date = latest_forecast['ds'].strftime('%d %B %Y')
        predicted_amount = max(0.0, float(latest_forecast['yhat'])) # yhat adalah nilai estimasi dari Prophet
        print(f"=== [DEBUG PROPHET] Training selesai. Hasil prediksi: Tanggal {predicted_date}, Nominal: {predicted_amount} ===")

        # 6. Simpan hasil ramalan AI ini ke dalam tabel Insights nasabah
        # Cek dulu apakah insight forecast bulan ini sudah ada biar gak spamming
        existing_forecast = db.query(Insight).filter(
            Insight.user_id == user_id,
            Insight.type == "bill_forecast"
        ).first()

        msg = f"Ssst! AI wondr memprediksi tagihan rutin kamu berikutnya akan jatuh tempo sekitar tanggal {predicted_date} dengan estimasi nominal Rp {predicted_amount:,.0f}. Siapkan danamu ya!"

        if existing_forecast:
            # Update ramalan lama dengan perhitungan terbaru
            existing_forecast.message = msg
            existing_forecast.predicted_date = predicted_date
        else:
            # Buat baris baru di DB jika belum pernah ada
            new_insight = Insight(
                user_id=user_id,
                type="bill_forecast",
                category="bills",
                message=msg,
                predicted_date=predicted_date
            )
            db.add(new_insight)
            
        db.commit()
        print("=== [DEBUG PROPHET] Berhasil commit data insight baru ke SQLite database! ===\n")
        return {"status": "forecasted", "predicted_date": predicted_date, "amount": predicted_amount}