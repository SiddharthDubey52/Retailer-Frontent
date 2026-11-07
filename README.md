# Mobile Shop Frontend

React/Vite client for the Mobile Shop Inventory Management System. Backend source and dependencies are not required to build the UI.

## Local setup

1. Copy `.env.example` to `.env` (the default `/api` uses the Vite proxy).
2. Install dependencies: `npm install`.
3. Start Vite: `npm run dev`.

The development proxy forwards `/api` to `http://localhost:5001`, matching the local backend `.env`. Set `VITE_API_URL` to the backend origin ending in `/api` when using a different local port.

## Later Vercel deployment

Do not deploy until the backend has been independently deployed and verified. Import this folder/repository as a Vite project with build command `npm run build`, output directory `dist`, and Vercel environment variable `VITE_API_URL=https://<render-service>.onrender.com/api`. Redeploy the backend with `CLIENT_ORIGIN` set to the final Vercel HTTPS origin.

Only `VITE_*` values are compiled into the browser. Never put MongoDB credentials, JWT secrets, setup keys, or the HiCellTek API key in frontend variables.

## Checks

- `npm run lint`
- `npm run build`
