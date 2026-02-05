from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.shared.config.settings import settings
from src.modules.video_processing.api.routes import router as video_router
from src.modules.video_upload.api.routes import router as upload_router

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Video processing platform API"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(video_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "env": settings.APP_ENV,
        "debug": settings.DEBUG
    }

@app.get("/")
async def root():
    return {"message": "Welcome to One Click Video API"}
