# SecSphere

Integrated frontend and backend setup for local development and production-style serving.

## Project Structure

- `Frontend/` : React + Vite UI
- `backend/` : Express API and scanner services

## Quick Start

Install dependencies in both apps:

```bash
npm --prefix backend install
npm --prefix Frontend install
```

Run frontend and backend together from repo root:

```bash
npm run dev
```

This starts:

- backend on `http://localhost:5000`
- frontend on Vite dev server (`http://localhost:5173` by default)

## API Integration

- Frontend calls API using `VITE_API_BASE_URL` (defaults to `/api`).
- In local dev, Vite proxies `/api` to backend (`http://localhost:5000` by default).
- Override dev proxy target with `VITE_DEV_API_PROXY_TARGET` if needed.

## Environment Files

- Copy `backend/.env.example` to `backend/.env` and fill required values.
- Copy `Frontend/.env.example` to `Frontend/.env` if you want custom frontend API config.

## Build + Serve (Single Backend Process)

Build the frontend:

```bash
npm run build
```

Start backend:

```bash
npm run start
```

If `Frontend/dist` exists, backend serves the frontend static files and SPA routes while still exposing API routes under `/api`.
