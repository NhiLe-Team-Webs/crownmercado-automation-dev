import pytest
from uuid import uuid4
from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.domain.value_objects import JobStatus, Transcript

def test_video_job_creation():
    user_id = 1
    path = "/tmp/video.mp4"
    job = VideoJob(user_id=user_id, input_file_path=path)
    
    assert job.status == JobStatus.UPLOADED
    assert job.user_id == user_id
    assert job.input_file_path == path
    assert isinstance(job.id, type(uuid4()))

def test_video_job_status_transitions():
    job = VideoJob(user_id=1, input_file_path="test.mp4")
    
    job.mark_as_queued()
    assert job.status == JobStatus.QUEUED
    
    job.mark_as_processing()
    assert job.status == JobStatus.PROCESSING
    
    job.mark_as_completed(output_paths=["/out/1.mp4"])
    assert job.status == JobStatus.COMPLETED
    assert len(job.output_file_paths) == 1

def test_video_job_failed():
    job = VideoJob(user_id=1, input_file_path="test.mp4")
    job.mark_as_failed()
    assert job.status == JobStatus.FAILED
