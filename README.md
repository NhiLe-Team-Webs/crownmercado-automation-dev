# One Click Video

Hệ thống xử lý video tự động với kiến trúc Modular Monolith và thiết kế hiện đại lấy cảm hứng từ YouTube Studio.

## 🚀 Hướng dẫn cài đặt nhanh (Local Development)

### 1. Yêu cầu hệ thống
- Python 3.11+
- Docker & Docker Compose
- Git Bash (Nếu dùng Windows)

### 2. Thiết lập môi trường ảo (Virtual Environment)
Để tránh xung đột thư viện, luôn sử dụng `venv`:

```bash
# Tạo môi trường ảo (chỉ làm 1 lần)
python -m venv venv

# Kích hoạt môi trường ảo
# Windows (Git Bash):
source venv/Scripts/activate
# macOS/Linux:
source venv/bin/activate
```

### 3. Cài đặt thư viện
```bash
pip install -r requirements.txt
```

### 4. Thiết lập Infrastructure & Database
Khởi chạy databases (Postgres, Redis) và pgAdmin:

```bash
# Copy file env mẫu
cp .env.example .env

# Chạy Docker Compose
docker compose -f docker-compose.dev.yml up -d
```

### 5. Chạy Database Migrations
Cập nhật cấu trúc bảng vào database local:

```bash
alembic upgrade head
```

## 🛠 Tech Stack
- **Backend**: FastAPI, SQLAlchemy, Alembic, Celery, Redis.
- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, TanStack Query.
- **Database**: PostgreSQL.
- **Storage**: AWS S3.

## 📂 Cấu trúc thư mục
- `src/`: Mã nguồn Backend (Python).
- `frontend/`: Mã nguồn Frontend (Next.js).
- `docker/`: Các file cấu hình Docker.
- `alembic/`: Quản lý database migrations.
