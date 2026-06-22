# Skill Exchange Platform

This repository contains a **full‑stack skill‑swap marketplace** built with **React (Vite)** on the frontend and **Node.js/Express** on the backend. Users can register, log in, find complementary skill matches, send swap requests, book video sessions, and chat with an AI assistant powered by Google Gemini.

---

## 📂 Directory Structure

```
Skill Exchange Platform/
│
├─ src/                     # Front‑end source (React + TypeScript)
│   ├─ app/                 # Main app component and page containers
│   │   ├─ App.tsx          # Root component, routing, authentication, API helper
│   │   └─ components/      # Re‑usable UI pieces (AdminTab, Dashboard, etc.)
│   └─ config.ts            # Exports API base URL from VITE_API_URL
│
├─ server/                  # Backend (Express)
│   ├─ index.cjs            # API routes, Socket.io, DB connection
│   ├─ db.cjs               # Mongoose models & helper functions
│   └─ cron.cjs             # Scheduled background jobs
│
├─ public/                  # Static assets (favicon, index.html)
├─ .env                     # Environment variables (PORT, MONGO_URI, etc.)
├─ vite.config.ts           # Vite config – dev proxy, env handling
├─ package.json
└─ README.md                # This file
```

---

## ⚙️ Environment & Configuration

| Variable | Scope | Description |
|----------|-------|-------------|
| `PORT` | Backend | Port on which the Express server listens (default **5000**). |
| `MONGO_URI` | Backend | MongoDB Atlas connection string. |
| `GEMINI_API_KEY` | Backend | Google Gemini API key (optional, for the AI chatbot). |
| `VITE_API_URL` | Frontend | Base URL for all API calls; used by `safeFetchJson`. Must point to the running backend (e.g., `http://localhost:5000`). |

> **Important:** The frontend reads `VITE_API_URL` via `import.meta.env.VITE_API_URL`. Without it, API requests fall back to a relative path and result in a **404** (the issue previously fixed).

---

## 🚀 Running Locally (Development)

1. **Install dependencies**
   ```bash
   npm i
   ```

2. **Create a `.env` file** (you can copy from a sample if present) and add the required variables:
   ```env
   PORT=5000
   MONGO_URI=your‑mongodb‑connection‑string
   VITE_API_URL=http://localhost:5000   # ← crucial for API calls
   GEMINI_API_KEY=your‑gemini‑key      # optional
   ```

3. **Start the backend** (in a separate terminal):
   ```bash
   node server/index.cjs   # or npm run server if a script is defined
   ```

4. **Start the frontend**:
   ```bash
   npm run dev
   ```

5. Open your browser at **http://localhost:5173** (Vite’s default dev server). The app will proxy `/api/*` requests to the backend thanks to the Vite proxy configuration, and `API_URL` will be used for production builds.

---

## 📡 API Overview

All endpoints are prefixed with **`/api`**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | Register a new user. |
| `POST` | `/api/login` | Authenticate a user and receive a session token. |
| `POST` | `/api/forgot-password` | Send a password‑reset email. |
| `POST` | `/api/reset-password` | Reset password using the token received via email. |
| `GET`  | `/api/matches` | Retrieve skill‑match suggestions for the logged‑in user. |
| `GET`  | `/api/requests` | List incoming/outgoing swap requests. |
| `POST` | `/api/requests/send` | Send a new swap request. |
| `POST` | `/api/requests/update` | Accept or decline a request. |
| `GET`  | `/api/bookings` | List booked video sessions. |
| `POST` | `/api/bookings/create` | Create a new video‑session booking. |
| `POST` | `/api/chatbot/message` | Get an AI response from Gemini (optional). |
| `GET/POST` | `/api/admin/*` | Admin utilities – statistics, user management, database seeding, etc. |

Responses follow the shape `{ success: boolean, ... }`. Errors include an appropriate HTTP status code and an `error` field.

---

## 📦 Production / Deployment

### Frontend
*Deploy to Vercel, Netlify, or any static‑host.*
1. Set the **environment variable** `VITE_API_URL` in the hosting dashboard to the public URL of your backend (e.g., `https://api.my‑skillswap.com`).
2. Run `npm run build` – Vite will generate an optimized static bundle.

### Backend
*Deploy the Express server to a VPS, Railway, Render, or as a Vercel Serverless Function.*
- Ensure CORS is configured to allow only your frontend domain.
- Keep `PORT` and `MONGO_URI` (and optionally `GEMINI_API_KEY`) as environment variables in the hosting environment.
- If using a serverless platform, make sure the `/uploads` directory is either persisted to external storage (e.g., S3) or that you handle uploads differently.

### Database
- Use a managed MongoDB service such as **MongoDB Atlas**. Whitelist the IPs of your hosting services.

---

## 🛡️ Security & Best Practices
- Passwords are hashed with **bcrypt** before storage.
- Consider adding **rate limiting** on authentication endpoints (e.g., `express-rate-limit`).
- Use **helmet** middleware to set secure HTTP headers.
- Store secrets (`MONGO_URI`, `GEMINI_API_KEY`) only in environment variables—not in source control.

---

## 🧪 Testing (Future Work)
The repository currently does not include automated tests. Adding a test suite is recommended:
- **Backend:** Jest + Supertest for API endpoint testing.
- **Frontend:** React Testing Library & Vitest for component/unit tests.

---

## 📜 Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/awesome-feature`).
3. Follow the existing code style (run `npm run lint`/`prettier`).
4. Submit a Pull Request with a clear description of your changes.

---

## 🎉 Summary
- The 404 issue was fixed by centralising API calls through `safeFetchJson` that prepends `API_URL`.
- This README now provides an in‑depth overview, setup guide, API reference, deployment notes, and suggestions for future improvements.

Enjoy building and extending the **Skill Exchange Platform**!