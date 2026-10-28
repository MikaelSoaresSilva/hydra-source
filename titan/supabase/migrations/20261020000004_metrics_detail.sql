-- Titan — medidas detalhadas para o Protocolo Olympia (lado direito/esquerdo, relaxado/contraído)
alter table public.body_metrics
  add column if not exists thigh_left_cm numeric(5,1) check (thigh_left_cm between 30 and 110),
  add column if not exists arm_right_relaxed_cm numeric(4,1) check (arm_right_relaxed_cm between 15 and 80),
  add column if not exists arm_left_relaxed_cm numeric(4,1) check (arm_left_relaxed_cm between 15 and 80),
  add column if not exists forearm_right_cm numeric(4,1) check (forearm_right_cm between 15 and 60),
  add column if not exists forearm_left_cm numeric(4,1) check (forearm_left_cm between 15 and 60),
  add column if not exists calf_right_cm numeric(4,1) check (calf_right_cm between 20 and 70),
  add column if not exists calf_left_cm numeric(4,1) check (calf_left_cm between 20 and 70),
  add column if not exists hip_cm numeric(5,1) check (hip_cm between 50 and 200);
