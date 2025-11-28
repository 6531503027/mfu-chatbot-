# Dockerfile (backend)

FROM python:3.11-slim

# ทำให้ Python ไม่สร้าง .pyc และ log ออก stdout ทันที
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# โฟลเดอร์ทำงานใน container
WORKDIR /app

# ติดตั้ง dependency พื้นฐานที่บาง lib ต้องใช้ (เช่น psycopg2-binary, sentence-transformers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ----- ติดตั้ง Python dependencies -----
# requirements.txt อยู่ในโฟลเดอร์ app/ ของโปรเจกต์ (บนเครื่องเรา)
COPY app/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ----- คัดลอก source code ทั้ง backend -----
# หลังจากบรรทัดนี้ ใน container จะมีโครงแบบ /app/app/main.py ฯลฯ
COPY app/ ./app

# เปิด port 8000 ให้เข้าถึง FastAPI
EXPOSE 8000

# คำสั่งรัน backend
# - module name = app.main
# - object FastAPI = app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
