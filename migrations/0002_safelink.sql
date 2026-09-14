-- SafeLink Uganda — national dispatch schema
create table if not exists sl_meta (
  key   text primary key,
  value text not null
);

create table if not exists sl_operators (
  username      text primary key,
  display_name  text not null,
  role          text not null,
  password_hash text not null
);

create table if not exists sl_units (
  id                 text primary key,
  type               text not null,
  agency             text not null,
  country            text not null,
  region             text not null,
  zone               text not null,
  lat                double precision not null,
  lng                double precision not null,
  status             text not null,
  capacity           integer not null,
  phone              text not null,
  assigned_incident  text
);

create table if not exists sl_hospitals (
  id               text primary key,
  name             text not null,
  country          text not null,
  tier             text not null,
  ownership        text not null,
  region           text not null,
  zone             text not null,
  lat              double precision not null,
  lng              double precision not null,
  beds_total       integer not null,
  beds_available   integer not null,
  trauma_total     integer not null,
  trauma_available integer not null,
  phone            text not null
);

create table if not exists sl_emts (
  id        text primary key,
  name      text not null,
  level     text not null,
  cert_body text not null,
  agency    text not null,
  region    text not null,
  phone     text not null,
  status    text not null
);

create table if not exists sl_incidents (
  id            text primary key,
  type          text not null,
  location      text not null,
  region        text not null,
  country       text not null,
  lat           double precision not null,
  lng           double precision not null,
  casualties    integer not null,
  description   text not null,
  source        text not null,
  reporter      text not null,
  status        text not null,
  time_label    text not null,
  reported_at   bigint not null,
  assigned      jsonb not null default '[]'::jsonb,
  log           jsonb not null default '[]'::jsonb,
  hospital_link jsonb
);

create table if not exists sl_calls (
  id           text primary key,
  channel      text not null,
  from_number  text not null,
  incident_id  text not null,
  verified     boolean not null default false,
  time_label   text not null,
  created_at   timestamptz not null default now()
);

create table if not exists sl_outbound (
  id         text primary key,
  name       text not null,
  phone      text not null,
  region     text not null,
  status     text not null,
  time_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists sl_sms (
  id         text primary key,
  phone      text not null,
  body       text not null,
  time_label text not null,
  created_at timestamptz not null default now()
);

create index if not exists sl_incidents_status_idx on sl_incidents (status);
create index if not exists sl_units_status_idx on sl_units (status);
create index if not exists sl_calls_incident_idx on sl_calls (incident_id);
