from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, complaints, dashboard, gov_data, users
from app.config import settings

app = FastAPI(title="JanVani API")

app.add_middleware(
    CORSMiddleware,
    # Add the deployed frontend origin (https://<project>.web.app) here
    # once the backend is deployed to Cloud Run.
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(complaints.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(gov_data.router)


@app.get("/health")
def health():
    return {"status": "ok"}
