from celery import Celery
from src.shared.config.settings import settings

celery_app = Celery(
    settings.APP_NAME,
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["src.worker.tasks", "src.worker.pipeline_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=2, # As per architecture.md
)

if __name__ == "__main__":
    celery_app.start()
