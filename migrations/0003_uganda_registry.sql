create table if not exists sl_uganda_registry (
  registry_key text primary key,
  entity_type text not null,
  name_or_id text not null,
  location_station text not null,
  district_region text not null,
  type_notes text not null,
  contact_phone text not null,
  contact_email_or_other text not null,
  ownership text not null,
  source_notes text not null,
  last_updated_approx text not null,
  is_operational boolean not null default false,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sl_uganda_registry_entity_idx on sl_uganda_registry (entity_type);
create index if not exists sl_uganda_registry_region_idx on sl_uganda_registry (district_region);
create index if not exists sl_uganda_registry_operational_idx on sl_uganda_registry (is_operational);
