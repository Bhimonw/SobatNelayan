# SobatNelayan — Development README

This repository contains a Backend (Node/Express + Sequelize) and Frontend (Vue 3 + Vite) for the SobatNelayan project.

## Environment variables

Each service keeps example env files you can copy and fill with real secrets:

- `Backend/.env.example` -> copy to `Backend/.env` and update values (do NOT commit secrets)
- `Frontend/.env.example` -> copy to `Frontend/.env` or `Frontend/.env.local` for local overrides

Both `Backend` and `Frontend` include `.gitignore` entries for `.env` files.

Key variables you will likely need to set:

- Backend: `PORT`, `JWT_SECRET`, `REFRESH_SECRET`, database credentials (`DB_*`), Firebase keys (`FIREBASE_*`)
- Frontend (Vite): `VITE_API_BASE`, `VITE_SOCKET_URL` (note: Vite env vars must start with `VITE_`)

## Run locally (development)

1. Create env files from examples for both services.
2. Start the backend from the `Backend` folder (uses port from `Backend/.env`):

```powershell
cd Backend
npm install
node server.js
```

3. Start the frontend from the `Frontend` folder:

```powershell
cd Frontend
npm install
npm run dev
```

If you use the workspace tasks, run the `Dev: start all` task in VS Code which starts both services in parallel.
