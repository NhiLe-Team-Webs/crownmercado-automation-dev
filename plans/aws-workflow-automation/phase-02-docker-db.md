# Phase 2: Project Dockerization & Base Services (Completed)

## Overview
Đóng gói ứng dụng Backend (FastAPI) thành Docker Image chuẩn Self-host và thiết lập hạ tầng Database dùng chung trên máy chủ EC2.

## Implementation History & Scripts

### 1. Refactor Dockerfile & Entrypoint (Step 2.1)
Tạo cơ chế tự động chạy Migration (Alembic) khi container khởi động để hỗ trợ việc "nhân bản" hệ thống sạch cho mỗi user.

**File: `docker/entrypoint.sh`**
```bash
#!/bin/bash
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Starting FastAPI server..."
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

**File: `docker/Dockerfile.api` (Updated)**
- Chuyển sang dùng `python:3.11-slim` để giảm dung lượng.
- Xóa bỏ `--reload` (chỉ dùng cho development).
- Sử dụng `ENTRYPOINT` trỏ vào script ở trên.

### 2. Thiết lập Shared Database trên EC2 (Step 2.2)
Chạy một instance Postgres duy nhất trên máy chủ vật lý để tiết kiệm RAM (t3.micro chỉ có 1GB).
Lệnh đã thực thi trên EC2:
```bash
sudo docker run -d \
  --name shared-postgres \
  --restart always \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin_pass_123 \
  -p 5432:5432 \
  postgres:15-alpine
```

### 3. Tối ưu hóa Build Context & .dockerignore (Step 2.3)
Do project có nhiều file nặng (Frontend, venv, node_modules), bước Build ban đầu bị lỗi **Out of Memory**. Chúng ta đã tạo file `.dockerignore` để loại bỏ các thành phần không cần thiết cho Backend:
```text
frontend/
node_modules/
venv/
.git/
llm_context/
plans/
docs/
```

### 4. Build, Tag & Push to Amazon ECR (Step 2.4)
Các lệnh thực thi tại máy Local để đẩy Image lên đám mây:
```bash
# 1. Đăng nhập ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 223776318322.dkr.ecr.ap-southeast-2.amazonaws.com

# 2. Build Image
docker build -t crownmercado-poc -f docker/Dockerfile.api .

# 3. Tag Image
docker tag crownmercado-poc:latest 223776318322.dkr.ecr.ap-southeast-2.amazonaws.com/crownmercado-poc:latest

# 4. Push Image
docker push 223776318322.dkr.ecr.ap-southeast-2.amazonaws.com/crownmercado-poc:latest
```

## Verification
- **ECR:** Image `crownmercado-poc:latest` đã xuất hiện trong Console (Dung lượng ~325MB).
- **EC2:** Container `shared-postgres` đang ở trạng thái `Up`.
- **Image Integrity:** Đã kiểm tra Layer và Digest thành công.

## Key Insights for Training
- **Auto-migration:** Việc nhúng `alembic upgrade head` vào entrypoint là bắt buộc để tự động hóa khâu bàn giao hệ thống.
- **Shared DB Instance:** Tiết kiệm khoảng 200MB RAM cho mỗi user bằng cách dùng chung 1 container DB nhưng chia Database Name.
- **Docker Context:** Luôn phải kiểm tra `.dockerignore` trước khi build để tránh upload rác làm treo hệ thống build.
