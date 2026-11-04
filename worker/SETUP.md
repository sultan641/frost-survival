# Frost Survival YouTube processing worker

The GitHub Actions worker checks the queue automatically every 15 minutes and can also be started manually from Actions → Frost Survival YouTube Worker → Run workflow. It processes one queued video per run to limit resource use. Scheduled runs are enabled.

## Required GitHub repository secrets

Open Settings → Secrets and variables → Actions → New repository secret. Add:

- `SUPABASE_URL` — `https://xnixsavppmmvbzfnybus.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Project Settings → API Keys → service_role secret. Never put this in website JavaScript.
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — the exact encryption key already configured for the YouTube OAuth callback.
- `GOOGLE_CLIENT_ID` — the same Google OAuth client ID used by Supabase.
- `GOOGLE_CLIENT_SECRET` — the same Google OAuth client secret used by Supabase.
- `ADMIN_UID` — `9cd04a06-6937-474a-9b13-ea39b2c3bd35`

Do not paste secrets into chat, issues, commits, or website files.

## What the worker does

1. Claims the oldest uploaded/queued job (or a stale processing job).
2. Downloads the original privately from Supabase Storage.
3. Transcribes speech locally with Faster-Whisper and scores short windows using speech activity and visual scene changes.
4. Creates a vertical 9:16 MP4, captions when FFmpeg subtitle support is available, optional neural narration and original procedurally generated ambient music.
5. Generates a thumbnail and topic-aware title/tags/description, including the Frost Survival game and Discord links.
6. If Auto Mode is ON, uploads using the selected YouTube visibility. If Auto Mode is OFF, marks the edited result ready for review; Sultan must approve it in Studio.
7. Saves the edited video privately and updates queue progress.

A custom YouTube title can be entered before upload. Leave it blank to use the generated title.

## Important limits

- One video is processed per run; a backlog drains at roughly one job per 15 minutes.
- This is an automated highlight editor, not human-level understanding of every in-game event. Scene changes and speech are proxies; always review output quality.
- Vertical center cropping may cut off important UI at the edges.
- AI narration and generated music are optional. TTS/network failures can fall back to captions/game audio.
- Auto Mode can publish as Private, Unlisted or Public according to the selected setting. Start with Private until output quality is verified.
- GitHub Actions has runtime and free-usage limits. If a run fails, inspect the Actions log and Studio queue.
- A public upload can still receive copyright claims for protected game audio or footage. No tool can guarantee a claim-free result.
