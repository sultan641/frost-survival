FROST SURVIVAL PREMIUM WEBSITE — ZIP CONTENTS

Files:
- index.html: redesigned home page
- wos-v4.html, v5-europe.html, v5-china.html, kingshot-v4.html: game pages
- team.html: creator/agent/moderator/support/livestream applications
- bug-report.html: bug reports with screenshot field
- admin.html: Supabase email/password admin console
- style.css, app.js, forms.js, admin.js: shared styling and scripts
- supabase-setup.sql: database/RLS starter SQL

PRESERVED LINKS
- WOS V4: https://landing.jkqwio.com/?invite=92lKnzFdINCXVccIz65
- V5 Europe: https://europa.176.9.65.91.nip.io/
- V5 China: https://passport.wjdr2.top/ops-register?promo=sultaan
- KingShot V4: https://landing.yunxiaoze.com/?id=YqZv76nI
- V5 Europe promoter code: 16365
- Discord: https://discord.gg/NVf6zsb35
- Telegram: https://t.me/frostsurvival
- YouTube: https://youtube.com/@gm_sultaan
- TikTok: https://www.tiktok.com/@wolfwos
- WhatsApp: https://chat.whatsapp.com/KahZb9cmJtKE8OBt8iN1yO
- Management: https://discord.com/users/1358805412694069550

IMPORTANT BEFORE DEPLOYING
1. This ZIP is a prepared starter package; it has not been uploaded to your GitHub repository.
2. It uses your existing Supabase URL and publishable key. Publishable keys are intended for browser use; NEVER add a service_role/secret key to client files.
3. Open Supabase Dashboard > Authentication > Users and create your admin account. Copy that user's UUID.
4. Replace every YOUR_SUPABASE_AUTH_USER_UUID placeholder in supabase-setup.sql with your actual admin UUID. Run the SQL in Supabase SQL Editor. Review it before running because it adjusts policies on existing tables.
5. Your existing gift_codes table must have: game_name, code, active. Existing announcements must have game_name, title, message, created_at. Check schema before running SQL.
6. Admin sign-in requires an email/password user. The database RLS allowlist is the real access control; hiding admin.html is not security.
7. Screenshot upload UI is present but actual upload is intentionally not enabled yet. Create a private Supabase Storage bucket and carefully configure storage.objects RLS policies before enabling uploads. The bug form currently reports that screenshot upload needs setup.
8. Game gift codes are loaded from Supabase for each exact game_name. V5 Europe has no hardcoded fallback codes; add active codes in the database for "Whiteout Survival V5 Europe".
9. The current SQL makes announcements public to read, but only the UUID admin can manage them. Admin console actions will fail until the UUID placeholder is replaced and policies are applied.
10. Before going live, test public submissions, anonymous reads, and admin access with a second non-admin account. Review Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security

DEPLOY TO GITHUB PAGES
1. Download and extract this ZIP on your phone or computer.
2. Open https://github.com/sultan641/frost-survival
3. Upload/replace the files at the repository root. Keep the filenames unchanged.
4. Commit the changes, then open Settings > Pages and ensure Pages is enabled for the correct branch.
5. Visit https://sultan641.github.io/frost-survival/ and test each page.

NOTE: This package is not a guarantee of production security until the Supabase setup and policies have been reviewed and applied.
