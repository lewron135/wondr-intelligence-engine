# 1. Gunakan base image Python 3.13 resmi yang stabil
FROM python:3.13-slim

# 2. Set working directory di dalam container
WORKDIR /app

# 3. Install SEMUA dependencies OS Linux yang mutlak dibutuhkan untuk compile Prophet & CmdStan
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    gcc \
    python3-dev \
    liblzma-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy file requirements.txt dari laptop lu ke dalam container
COPY requirements.txt .

# 5. Upgrade pip dan install wheel agar install library berat bisa lebih mulus
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# 6. Install semua library Python dari requirements.txt
# --prefer-binary: prioritaskan wheel pre-built daripada compile dari source
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# 7. Copy seluruh source code backend dari folder lokal ke dalam container
COPY . .

# 8. Beritahu Docker bahwa container ini berjalan di port 8000
EXPOSE 8000

# 9. Perintah untuk menjalankan backend FastAPI menggunakan Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]