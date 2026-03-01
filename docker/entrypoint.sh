#!/bin/bash
set -e

# Sử dụng biến môi trường được truyền vào từ docker-compose
DB_NAME_TO_CREATE=${POSTGRES_DB:-crownmercado_automation_dev}
PG_HOST=${POSTGRES_HOST:-postgres}
PG_USER=${POSTGRES_USER:-postgres}
export PGPASSWORD=${POSTGRES_PASSWORD:-password}

echo "Checking if database $DB_NAME_TO_CREATE exists at $PG_HOST..."
RETRIES=10
until psql -h "$PG_HOST" -U "$PG_USER" -d postgres -c "select 1" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for postgres server, $((RETRIES--)) remaining attempts..."
  sleep 2
done

# Tạo database nếu chưa có
DATABASE_EXISTS=$(psql -h "$PG_HOST" -U "$PG_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME_TO_CREATE'")
if [ "$DATABASE_EXISTS" != "1" ]; then
    echo "Database $DB_NAME_TO_CREATE does not exist. Creating..."
    psql -h "$PG_HOST" -U "$PG_USER" -d postgres -c "CREATE DATABASE $DB_NAME_TO_CREATE"
    echo "Database created successfully."
else
    echo "Database $DB_NAME_TO_CREATE already exists."
fi

echo "Running database migrations..."
# Alembic giờ đã có alembic.ini (vì đã gỡ khỏi .dockerignore)
alembic upgrade head

echo "Starting FastAPI server..."
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000
