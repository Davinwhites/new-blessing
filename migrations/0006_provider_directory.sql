alter table sl_hospitals add column if not exists services text not null default '';
alter table sl_hospitals add column if not exists address text not null default '';
alter table sl_hospitals add column if not exists operating_hours text not null default 'Open 24 hours';
alter table sl_hospitals add column if not exists whatsapp text not null default '';
