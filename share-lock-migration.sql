-- Frost Survival: per-game Share Lock setting
-- Run once in Supabase Dashboard > SQL Editor.
-- Adds a separate on/off setting for each game_settings row.
alter table public.game_settings
  add column if not exists share_lock boolean not null default false;
