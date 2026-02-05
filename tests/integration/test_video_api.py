import pytest
from httpx import AsyncClient
from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.domain.value_objects import JobStatus

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_create_job_api(db_session):
    # Lưu ý: Trong thực tế cần override dependency db_session của FastAPI 
    # để dùng chung session với test
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/jobs/", 
            params={"user_id": 1, "file_path": "/test/video.mp4"}
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == 1
    assert data["status"] == JobStatus.UPLOADED
