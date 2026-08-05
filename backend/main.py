from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# App Initialization
app = FastAPI(
    title="FocusLab API",
    version="0.1.0",
)


# Middleware to allow Next.js frontend to communicate with FastAPI Safetely 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[                                        #Only allow this https safetly 
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],              #Options allowed
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
async def root():
    return {"message": "FocusLab backend is running"}