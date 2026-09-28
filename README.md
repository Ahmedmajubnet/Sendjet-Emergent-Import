# SendJet - sanitized application export

Contains the backend, frontend source, public assets, dependency manifests, and
safe environment examples. No Git history, real environment files, tests,
credential notes, preview tooling, analytics project tokens, dependencies,
or build output are included.

## Configure privately before running

- Use a new local or test MongoDB database. The backend runs startup cleanup and
  demo seeding, so never point this temporary import at a production database.
- Copy the example environment files locally or configure private environment
  variables. Set a fresh random SECRET_KEY; no signing-secret fallback exists.
- Stripe is disabled until a key is supplied. Use only Stripe test credentials.
- Email sending is disabled without RESEND_API_KEY. Use test recipient addresses
  if you enable it; code confirmation emails require a working mail provider.
- Set the frontend API URL, backend CORS origins and public site URL for your
  temporary environment. Never put private backend keys in frontend variables.
- Google Maps is optional and needs its own configured key. Google sign-in and
  Stripe retain their required Emergent integration code; generated preview
  tooling and the hardcoded analytics bootstrap are excluded.

## Run

Install backend/requirements.txt into a private Python virtual environment.
From backend, run python -m uvicorn server:app --host 127.0.0.1 --port 8000.
Install frontend dependencies using the package manager declared in package.json.
From frontend, run npm start (or npm.cmd start in Windows PowerShell).
If the local ESLint integration blocks startup, set DISABLE_ESLINT_PLUGIN=true.

Only this export was sanitized. The original repository was not modified.
