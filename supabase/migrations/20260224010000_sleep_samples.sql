create table if not exists sleep_data (
  id uuid primary key default gen_random_uuid(),
  date_time timestamptz not null,
  sample_date date generated always as (date_time::date) stored,
  type text not null check (type in ('core','rem','deep','awake','unknown','total')),
  duration_minutes integer not null check (duration_minutes >= 0),
  source text not null default 'manual',
  raw jsonb,
  created_at timestamptz not null default now()
);

-- Create a view for backward compatibility with existing code
create or replace view sleep_samples as
select 
  id,
  date_time as sample_ts,
  sample_date,
  type as stage,
  duration_minutes,
  source,
  raw,
  created_at
from sleep_data;

create index if not exists idx_sleep_samples_date on sleep_samples(sample_date);
create index if not exists idx_sleep_samples_stage on sleep_samples(stage);

-- migrate existing aggregated sleep minutes into the new table if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_metrics' AND column_name = 'sleep_minutes'
  ) THEN
    EXECUTE $$
      insert into sleep_samples (sample_ts, stage, duration_minutes, source, raw)
      select (date::timestamptz), 'total', sleep_minutes, 'legacy_daily_metrics',
             jsonb_build_object('migrated_from', 'daily_metrics')
      from daily_metrics
      where sleep_minutes is not null
    $$;
  END IF;
END
$$;

alter table daily_metrics drop column if exists sleep_minutes;

-- Enhanced view that uses sleep_data directly
create or replace view sleep_daily_aggregates as
select
  sample_date as date,
  sum(case when stage = 'core' then duration_minutes else 0 end) as core_minutes,
  sum(case when stage = 'rem' then duration_minutes else 0 end) as rem_minutes,
  sum(case when stage = 'deep' then duration_minutes else 0 end) as deep_minutes,
  sum(case when stage = 'awake' then duration_minutes else 0 end) as awake_minutes,
  sum(case when stage <> 'awake' then duration_minutes else 0 end) as total_minutes,
  sum(case when stage <> 'awake' then duration_minutes else 0 end) + sum(case when stage = 'awake' then duration_minutes else 0 end) as in_bed_minutes,
  case
    when (sum(case when stage <> 'awake' then duration_minutes else 0 end) + sum(case when stage = 'awake' then duration_minutes else 0 end)) > 0
    then round(
      (
        sum(case when stage <> 'awake' then duration_minutes else 0 end)::numeric /
        (sum(case when stage <> 'awake' then duration_minutes else 0 end) + sum(case when stage = 'awake' then duration_minutes else 0 end))
      ) * 100
    )::int
    else null
  end as sleep_efficiency
from sleep_samples
group by sample_date;

-- New detailed view for sleep stage breakdowns (for advanced charts)
create or replace view sleep_stage_details as
select
  sample_date as date,
  stage,
  count(*) as stage_count,
  sum(duration_minutes) as total_minutes,
  avg(duration_minutes) as avg_minutes,
  min(duration_minutes) as min_minutes,
  max(duration_minutes) as max_minutes
from sleep_samples
where stage in ('core', 'rem', 'deep', 'awake')
group by sample_date, stage
order by sample_date, stage;

-- View for sleep timeline (chronological order of sleep stages)
create or replace view sleep_timeline as
select
  date_time,
  sample_date as date,
  stage,
  duration_minutes,
  source,
  raw
from sleep_data
order by date_time;

create or replace view daily_metrics_with_sleep as
select
  dm.date,
  dm.weight_lbs,
  dm.steps,
  agg.total_minutes as sleep_minutes,
  dm.calories_in,
  dm.protein_g,
  dm.carbs_g,
  dm.fat_g,
  dm.active_calories_out,
  dm.exercise_minutes,
  dm.resting_hr,
  dm.sleep_efficiency,
  dm.raw,
  dm.updated_at
from daily_metrics dm
left join sleep_daily_aggregates agg on agg.date = dm.date;
