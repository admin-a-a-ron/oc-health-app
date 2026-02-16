-- gyms
create table if not exists gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_default boolean not null default false,
  created_at timestamp with time zone default now()
);

-- gym equipment tags
create table if not exists gym_equipment (
  gym_id uuid not null references gyms(id) on delete cascade,
  equipment_tag text not null,
  created_at timestamp with time zone default now(),
  primary key (gym_id, equipment_tag)
);

-- workout_sessions: add gym_id
alter table workout_sessions
  add column if not exists gym_id uuid references gyms(id) on delete set null;

-- exercises: add required_equipment tags
alter table exercises
  add column if not exists required_equipment text[] not null default '{}'::text[];

-- backfill required_equipment from existing equipment column if present
update exercises
set required_equipment = coalesce(equipment, '{}'::text[])
where required_equipment = '{}'::text[];

-- seed gyms
insert into gyms (name, is_default)
values ('Home', true)
on conflict (name) do update set is_default = excluded.is_default;

insert into gyms (name, is_default)
values ('Commercial Gym', false)
on conflict (name) do nothing;

-- seed equipment tags
-- Home gym: barbell + rack + bench + dumbbell + cable + pullup_bar + cardio (stationary bike)
insert into gym_equipment (gym_id, equipment_tag)
select g.id, t.tag
from gyms g
cross join (values
  ('barbell'),
  ('rack'),
  ('bench'),
  ('dumbbell'),
  ('cable'),
  ('pullup_bar'),
  ('cardio')
) as t(tag)
where g.name = 'Home'
on conflict do nothing;

-- Commercial gym: basically everything (simple tags)
insert into gym_equipment (gym_id, equipment_tag)
select g.id, t.tag
from gyms g
cross join (values
  ('barbell'),
  ('rack'),
  ('bench'),
  ('dumbbell'),
  ('cable'),
  ('pullup_bar'),
  ('cardio'),
  ('machine')
) as t(tag)
where g.name = 'Commercial Gym'
on conflict do nothing;
