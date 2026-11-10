# HR Assistant frontend

React + TypeScript + Vite + Tailwind. Talks to the FastAPI backend (login, chat, leave, approvals, HR admin).

## Run it (Windows, PowerShell)

1. Start the backend from its project folder: `uvicorn main:app --app-dir app --reload` (default `http://127.0.0.1:8000`).
2. In this folder:

```
npm install
npm run dev
```

3. Open http://localhost:5173

In development the browser calls `/api/...` and Vite forwards it to the backend (the `/api` prefix is removed), so no CORS setup is needed.
If your backend uses another port, copy `.env.example` to `.env.local` and set `VITE_DEV_PROXY_TARGET`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run all tests once |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve the built site locally |

## Pages

- `/login`: employee ID and password (HR creates the logins).
- `/change-password`: forced after a temporary password; changing it logs you out, then log in again.
- `/chat`: ask HR policy questions or about your own leave. "Apply leave for 10 Nov 2026" asks for confirmation (Yes / No buttons, optional document upload) before anything is saved. Answers show their sources, with Retry and Cancel.
- `/leave`: balances, apply on the website (maternity is only possible here, with a document), my requests with Cancel.
- `/approvals`: pending leaves of the people who report to you (everyone's, for HR). Approve, reject, view the document.
- `/admin` (HR only): create a login, reset a password. The temporary password is shown once.

## Errors handled

Network down, 15 second timeout (60 seconds for chat), user cancel, 401 (session ended: automatic log out with a message), 403, 422 (field messages), 429/lock messages from the server, 5xx (friendly text, no raw errors), non-JSON error pages, and a crash screen for unexpected rendering errors. The session also ends after 30 minutes of inactivity.

## Production

Build with `npm run build` and host the `dist/` folder. Either serve it behind a reverse proxy that maps `/api` to the backend (nothing else to change),
or set `VITE_API_BASE_URL=https://your-api-host` at build time and add that site to CORS on the backend.
Single page app: the host must send `index.html` for unknown paths (for example `/chat`).

## Notes

- The login token lives in `sessionStorage` (cleared when the tab closes). Nothing secret is stored in the code.
- Hiding the admin page is only for convenience; the backend enforces HR-only access.
