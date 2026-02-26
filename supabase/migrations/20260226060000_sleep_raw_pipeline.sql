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

alter table sleep_data_raw
  add column if not exists bucket_date date,
  add column if not exists processed_at timestamptz;

create index if not exists idx_sleep_data_raw_bucket_date on sleep_data_raw(bucket_date);
create index if not exists idx_sleep_data_raw_processed on sleep_data_raw(processed_at);
