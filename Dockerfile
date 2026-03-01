# Sử dụng Python 3.11 làm base image (bạn có thể đổi thành phiên bản đang dùng)
FROM python:3.11-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Cài đặt các system dependencies nếu cần (như build-essential cho một số lib Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements trước để tận dụng Docker cache
COPY requirements.txt .

# Cài đặt thư viện
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn vào (bỏ qua những file trong .dockerignore)
COPY . .

# Thiết lập port ứng dụng của bạn (ví dụ 8000)
EXPOSE 8000

# Lệnh chạy ứng dụng (Thay đổi tùy vào app của bạn, vd FastAPI hay Flask/Django)
# Ví dụ cho FastAPI (uvicorn)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Ví dụ cho script thông thường:
# CMD ["python", "main.py"]
