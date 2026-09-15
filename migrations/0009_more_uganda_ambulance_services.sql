-- Idempotent registry additions for publicly known Uganda ambulance services.
-- Contacts should be re-confirmed by an administrator before public publication.
insert into sl_units (id, type, agency, country, region, zone, lat, lng, status, capacity, phone, assigned_incident)
values
  ('AMB-UG-IMG-KLA', 'Ambulance', 'International Medical Group (IMG) Emergency Ambulance', 'Uganda', 'Central', 'Kampala City Centre', 0.3100, 32.5900, 'available', 4, '+256 312 200 400', null),
  ('AMB-UG-CASE-KLA', 'Ambulance', 'Case Medical Centre Ambulance', 'Uganda', 'Central', 'Kampala City Centre', 0.3244, 32.5750, 'available', 4, '+256 414 250 362', null),
  ('AMB-UG-NSAM-KLA', 'Ambulance', 'St. Francis Hospital Nsambya Ambulance', 'Uganda', 'Central', 'Kampala Metropolitan Area', 0.3039, 32.5880, 'available', 4, '+256 414 267 012', null),
  ('AMB-UG-MOH-EAST', 'Ambulance', 'Ministry of Health National Ambulance Service — Eastern', 'Uganda', 'Eastern', 'Jinja / Mbale / Soroti', 0.4479, 33.2026, 'available', 4, '912', null),
  ('AMB-UG-MOH-WEST', 'Ambulance', 'Ministry of Health National Ambulance Service — Western', 'Uganda', 'Western', 'Mbarara / Fort Portal / Kabale', -0.6072, 30.6545, 'available', 4, '912', null)
on conflict (id) do update set
  agency = excluded.agency,
  region = excluded.region,
  zone = excluded.zone,
  lat = excluded.lat,
  lng = excluded.lng,
  type = excluded.type,
  phone = excluded.phone;
