alter table sleep_data
  add column if not exists sample_start_date_time timestamptz,
  add column if not exists date_bucket date;

create or replace function compute_sleep_date_bucket(ts timestamptz)
returns date language sql immutable as $$
  select date_trunc('day', (ts at time zone 'America/Los_Angeles') + interval '12 hours')::date;
$$;

update sleep_data
set sample_start_date_time = coalesce((raw->>'start')::timestamptz, date_time),
    date_bucket = compute_sleep_date_bucket(coalesce((raw->>'start')::timestamptz, date_time))
where sample_start_date_time is null or date_bucket is null;

create index if not exists idx_sleep_data_date_bucket on sleep_data(date_bucket);
