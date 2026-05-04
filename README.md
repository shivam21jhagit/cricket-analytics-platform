# CricketAI Platform

CricketAI is a local-first cricket intelligence platform with a React dashboard, FastAPI prediction service, ML-backed next-ball model, fantasy tools, and CricAPI-ready live match data.

## Run Locally

1. Copy `.env.example` to `.env`.
2. Add `CRICAPI_KEY` if you want live CricAPI data. Without it, the app serves a realistic demo feed.
3. Run the stack:

```bash
docker compose up --build
```

The web app runs at `http://127.0.0.1:3000` and the API runs at `http://127.0.0.1:8000`.

## Key API Routes

- `GET /health`
- `GET /platform/dashboard`
- `GET /platform/live-matches`
- `POST /prediction-intel`
- `POST /simulate`
- `POST /auth/demo-login`

OpenAPI docs are available at `http://127.0.0.1:8000/docs`.

## Current Shape

This repo is a production-shaped v1 scaffold rather than the final microservice mesh. The active implementation keeps the existing React + FastAPI app runnable, while the docs and Docker stack lay the path toward the full CricketAI brief: auth service, match service, prediction service, analytics service, notification service, LLM gateway, Redis, PostgreSQL, MongoDB, and later Kafka/ClickHouse.
