alter table sl_operators add column if not exists recovery_email text;
alter table sl_operators add column if not exists reset_token_hash text;
alter table sl_operators add column if not exists reset_token_expires_at timestamptz;
alter table sl_operators add column if not exists active boolean not null default true;
alter table sl_operators add column if not exists updated_at timestamptz not null default now();
