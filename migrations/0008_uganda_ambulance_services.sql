-- Reviewed starter registry of publicly known Uganda ambulance services.
-- Contacts should be re-confirmed by an administrator before public publication.
insert into sl_units (id, type, agency, country, region, zone, lat, lng, status, capacity, phone, assigned_incident)
values
  ('AMB-UG-RED-CENTRAL', 'Ambulance', 'Uganda Red Cross Society — Central Region', 'Uganda', 'Central', 'Kampala / Wakiso / Mukono', 0.3136, 32.5811, 'available', 4, '+256 760 588 189', null),
  ('AMB-UG-STJOHN', 'Ambulance', 'St John Ambulance Uganda — Kampala', 'Uganda', 'Central', 'Kampala Metropolitan Area', 0.3160, 32.5830, 'available', 4, '+256 414 230 671', null),
  ('AMB-UG-MOH-CENTRAL', 'Ambulance', 'Ministry of Health National Ambulance Service — Central', 'Uganda', 'Central', 'Central Uganda', 0.3200, 32.5850, 'available', 4, '912', null),
  ('AMB-UG-RED-EAST', 'Ambulance', 'Uganda Red Cross Society — Eastern Region', 'Uganda', 'Eastern', 'Jinja / Mbale / Soroti', 0.4479, 33.2026, 'available', 4, '+256 760 588 189', null),
  ('AMB-UG-MOH-NORTH', 'Ambulance', 'Ministry of Health National Ambulance Service — Northern', 'Uganda', 'Northern', 'Gulu / Lira / Arua / Moroto', 2.7747, 32.2990, 'available', 4, '912', null),
  ('AMB-UG-RED-WEST', 'Ambulance', 'Uganda Red Cross Society — Western Region', 'Uganda', 'Western', 'Mbarara / Fort Portal / Kabale', -0.6072, 30.6545, 'available', 4, '+256 760 588 189', null)
on conflict (id) do update set
  agency = excluded.agency,
  region = excluded.region,
  zone = excluded.zone,
  lat = excluded.lat,
  lng = excluded.lng,
  phone = excluded.phone,
  type = excluded.type;
