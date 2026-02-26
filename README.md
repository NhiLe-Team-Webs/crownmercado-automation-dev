
An automated video processing and delivery platform featuring a Modular Monolith architecture, built with modern principles inspired by YouTube Studio.

## 🚀 Features

- **Automated Provisioning:** Users can dynamically provision their own dedicated backend instances via a self-serve landing page integrated with AWS Lambda, ECS, and DynamoDB.
- **Video Processing Pipeline:** Seamlessly process, store, and manage video content with Celery, Redis, and AWS S3.
- **Modern Tech Stack:** High-performance Backend powered by FastAPI and an interactive Admin/User interface via Next.js.

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, Alembic, Celery, Redis
- **Frontend:** Next.js, React 19, Tailwind CSS v4, TanStack Query
- **Databases:** PostgreSQL (Shared instance for automated isolated tenant databases), Redis (Caching & Task Broker)
- **Infrastructure / Cloud:** AWS ECS (Elastic Container Service), AWS API Gateway, AWS Lambda, DynamoDB, AWS S3
- **Automation Pipeline:** Custom TypeScript Lambda function polling for dynamic port allocation and AWS SES / Resend integration for user onboarding.

## 💻 Local Development Guide

### 1. Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- Git Bash (Recommended for Windows users)

### 2. Python Virtual Environment Setup

To prevent dependency conflicts, initialize and use an isolated Python virtual environment (`venv`).

```bash
# Create the virtual environment (one-time setup)
python -m venv venv

# Activate the virtual environment
# Windows (Git Bash / PowerShell):
source venv/Scripts/activate
# macOS / Linux:
source venv/bin/activate
```

### 3. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 4. Infrastructure & Database Initialization

Start the local databases (PostgreSQL, Redis) and pgAdmin using Docker Compose.

```bash
# Create local environment configuration
cp .env.example .env

# Start infrastructure containers in the background
docker compose -f docker-compose.dev.yml up -d
```

### 5. Apply Database Migrations

Apply the latest schema changes to your local PostgreSQL instance:

```bash
alembic upgrade head
```

### 6. Starting the Application Locally

**Start the Backend Server (FastAPI):**
```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

## 📂 Project Structure

- `src/` - Backend Python source code, API routers, and Celery workers.
- `frontend/` - Next.js frontend application.
- `docker/` - Dockerfiles and deployment scripts (e.g., `Dockerfile.api`, `entrypoint.sh`).
- `alembic/` - Database migration scripts and environment configuration.
- `plans/` - Documentation & architecture playbooks (e.g., AWS Orchestration details).

## ☁️ Cloud Provisioning (AWS)

The platform supports live automated tenant isolation via ECS. Below is the simplified flow triggered from the external landing page:

1. **User Sign Up:** A POST request containing `admin_email`, `subdomain`, and `company_name` is sent to API Gateway.
2. **Lambda Orchestrator (`provision-lambda`):** 
   - Receives the request.
   - Triggers an `ecs:RunTask` command, dynamically injecting the user's specific context as environment variables.
   - Polls the ECS cluster until a runtime host port is mapped to the new container.
   - Registers the routing mappings to **DynamoDB**.
3. **Application Lifecycle:** The container boots up, executing Alembic migrations implicitly through `docker/entrypoint.sh` creating an isolated `db_tenant` within the shared RDS/EC2 Postgres network space.
4. **Completion:** A confirmation email is dispatched containing the generated tenant URL endpoint.
