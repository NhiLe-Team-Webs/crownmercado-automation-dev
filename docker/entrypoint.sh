#!/bin/bash
set -e

# Đợi Postgres sẵn sàng (Optional nhưng nên có nếu DB nằm ở xa)
# Ở đây mình giả định DB đã sẵn sàng vì nó chạy vĩnh viễn trên EC2

echo "Running database migrations..."
alembic upgrade head

echo "Starting FastAPI server..."
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000
