from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from typing import List
from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.application.handlers import CreateVideoJobUseCase, ProcessVideoJobUseCase
from src.modules.video_processing.infrastructure.repositories import PostgresVideoRepository
from src.shared.database.dependencies import DatabaseSession


router = APIRouter(prefix="/jobs", tags=["Video Jobs"])

@router.post("/", response_model=VideoJob)
async def create_job(
    user_id: int, 
    file_path: str,
    db: DatabaseSession
):
    repo = PostgresVideoRepository(db)
    use_case = CreateVideoJobUseCase(repo)
    return await use_case.execute(user_id, file_path)

@router.get("/{job_id}", response_model=VideoJob)
async def get_job(
    job_id: UUID,
    db: DatabaseSession
):
    repo = PostgresVideoRepository(db)
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("/{job_id}/process", response_model=VideoJob)
async def process_job(
    job_id: UUID,
    db: DatabaseSession
):
    repo = PostgresVideoRepository(db)
    use_case = ProcessVideoJobUseCase(repo)
    job = await use_case.execute(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
