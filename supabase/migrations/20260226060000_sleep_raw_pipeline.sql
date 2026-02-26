create table if not exists sleep_data_processed (
  id uuid primary key default gen_random_uuid(),
  date_bucket date not null,
  value text not null,
  total_minutes integer not null,
  sample_count integer not null,
  computed_at timestamptz not null default now()
);

create unique index if not exists idx_sleep_data_processed_bucket_value
  on sleep_data_processed(date_bucket, value);
