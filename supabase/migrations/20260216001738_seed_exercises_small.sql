insert into exercises
  (name, split_tag, pattern, angle, primary_muscles, secondary_muscles, equipment,
   rest_seconds_default, setup_seconds_default, set_seconds_default, is_unilateral, required_equipment)
values
('BB Back Squat', 'legs', 'squat', 'na', array['quads','glutes'], array['core','adductors'], array['barbell','rack'], 120, 180, 60, false, array['barbell','rack']),
('BB Romanian Deadlift (RDL)', 'legs', 'hinge', 'na', array['hamstrings','glutes'], array['core','upper_back'], array['barbell'], 120, 120, 60, false, array['barbell']),
('BB Deadlift (Conventional)', 'legs', 'hinge', 'na', array['hamstrings','glutes','lower_back'], array['upper_back','core'], array['barbell'], 120, 180, 60, false, array['barbell']),
('DB Bulgarian Split Squat', 'legs', 'lunge', 'na', array['quads','glutes'], array['core','adductors'], array['dumbbell','bench'], 120, 90, 90, true, array['dumbbell','bench']),
('DB Incline Press', 'push', 'horizontal', 'incline', array['chest','delts'], array['triceps'], array['dumbbell','bench'], 120, 60, 50, false, array['dumbbell','bench']),
('DB Flat Bench Press', 'push', 'horizontal', 'flat', array['chest'], array['delts','triceps'], array['dumbbell','bench'], 120, 60, 50, false, array['dumbbell','bench']),
('BB Flat Bench Press', 'push', 'horizontal', 'flat', array['chest'], array['delts','triceps'], array['barbell','bench','rack'], 120, 120, 60, false, array['barbell','bench','rack']),
('BB Overhead Press (OHP)', 'push', 'vertical', 'vertical', array['delts'], array['triceps','core'], array['barbell','rack'], 120, 120, 50, false, array['barbell','rack']),
('Cable Lat Pulldown', 'pull', 'vertical', 'vertical', array['lats'], array['biceps','upper_back'], array['cable'], 120, 45, 45, false, array['cable']),
('Pull-Up', 'pull', 'vertical', 'vertical', array['lats'], array['biceps','upper_back','core'], array['pullup_bar'], 120, 0, 45, false, array['pullup_bar']),
('DB Chest-Supported Row', 'pull', 'horizontal', 'horizontal', array['upper_back'], array['lats','biceps'], array['dumbbell','bench'], 120, 60, 50, false, array['dumbbell','bench']),
('Cable Seated Row', 'pull', 'horizontal', 'horizontal', array['upper_back'], array['lats','biceps'], array['cable'], 120, 45, 45, false, array['cable']),
('Cable Face Pull', 'pull', 'isolation', 'horizontal', array['rear_delts','upper_back'], array[]::text[], array['cable'], 90, 30, 40, false, array['cable']),
('DB Lateral Raise', 'push', 'isolation', 'na', array['delts'], array[]::text[], array['dumbbell'], 90, 15, 35, false, array['dumbbell']),
('DB Hammer Curl', 'arms', 'isolation', 'na', array['biceps','forearm'], array[]::text[], array['dumbbell'], 90, 15, 35, false, array['dumbbell']),
('Cable Triceps Pressdown', 'arms', 'isolation', 'na', array['triceps'], array[]::text[], array['cable'], 90, 15, 35, false, array['cable']),
('Dead Bug', 'core', 'core', 'na', array['abs'], array['obliques'], array['bodyweight'], 60, 0, 40, false, array[]::text[]),
('Side Plank', 'core', 'core', 'na', array['obliques'], array['abs'], array['bodyweight'], 60, 0, 40, true, array[]::text[])
on conflict (name) do nothing;
