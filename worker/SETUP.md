# Frost Survival YouTube processing worker

This worker is intentionally manual until its GitHub Actions secrets are configured and tested. It processes one `uploaded` job per run.

## Required GitHub repository secrets

Open Settings → Secrets and variables → Actions → New repository secret. Add:

- `SUPABASE_URL` — `https://xnixsavppmmvbzfnybus.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Project Settings → API Keys → service_role secret. Never put this in website JavaScript.
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — the exact encryption key already configured for the YouTube OAuth callback.
- `GOOGLE_CLIENT_ID` — the same Google OAuth client ID used by Supabase.
- `GOOGLE_CLIENT_SECRET` — the same Google OAuth client secret used by Supabase.
- `ADMIN_UID` — `9cd04a06-6937-474a-9b13-ea39b2c3bd35`

Do not paste secrets into chat, issues, commits, or website files.

## Run it

1. Add all six secrets.
2. Open the repository Actions tab.
3. Select **Frost Survival YouTube Worker**.
4. Tap **Run workflow**.

The worker takes the oldest `uploaded` job, downloads it from the private bucket, converts it to a centered 9:16 MP4, stores the processed file privately, and uploads it to YouTube as **Private**. It never makes a video public.

## Current limits

- One job per manual run; scheduling stays disabled until the first successful test.
- This is the first processing baseline, not full AI editing: smart scene selection, speech-to-text captions, AI titles, and approval controls are not implemented yet.
- Center cropping may cut off important UI at the edges. Review the private YouTube result before changing its visibility.
- Failed jobs are marked `failed` with an error in the studio queue. Fix the cause before retrying.
