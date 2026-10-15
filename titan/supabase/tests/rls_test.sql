\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');

-- Usuário A cria dados
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.profiles (age, height_cm) values (19, 180);
insert into public.programs (id, name, start_date) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ciclo A', '2026-10-12');
insert into public.workout_sessions (id, program_id, week, day_index, sequence) values ('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',1,0,0);
insert into public.set_logs (session_id, exercise_key, exercise_name, muscle, set_index, load_kg, reps, rir)
  values ('aaaaaaaa-0000-0000-0000-000000000002','barbell_curl','Rosca direta','biceps',0,30,10,2);
insert into public.body_metrics (date, weight_kg) values ('2026-10-14', 80);
insert into public.appearance_analyses (source, result) values ('questionnaire', '{"faceShape":"oval"}');
insert into public.daily_checkins (date, water_l) values ('2026-10-14', 2.5);
insert into storage.objects (bucket_id, name) values ('titan-private','11111111-1111-1111-1111-111111111111/f.jpg');

-- Usuário B não vê nem altera nada de A
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'B vê perfil de A'; end if;
  if (select count(*) from public.set_logs) <> 0 then raise exception 'B vê séries de A'; end if;
  if (select count(*) from public.body_metrics) <> 0 then raise exception 'B vê medidas de A'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'B vê fotos de A'; end if;
  if (select count(*) from public.appearance_analyses) <> 0 then raise exception 'B vê análises de A'; end if;
  delete from public.appearance_analyses;
  update public.body_metrics set weight_kg = 1;
  delete from public.set_logs;
end $$;

-- B não pode inserir com user_id de A
do $$ begin
  begin
    insert into public.body_metrics (user_id, date, weight_kg) values ('11111111-1111-1111-1111-111111111111','2026-10-14',70);
    raise exception 'FALHA: B inseriu como A';
  exception when insufficient_privilege then null; end;
end $$;

-- B não pode pendurar sessão em programa de A
do $$ begin
  begin
    insert into public.workout_sessions (program_id, week, day_index, sequence) values ('aaaaaaaa-0000-0000-0000-000000000001',1,1,1);
    raise exception 'FALHA: B usou programa de A';
  exception when insufficient_privilege then null; end;
end $$;

-- B não pode enviar foto para a pasta de A
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('titan-private','11111111-1111-1111-1111-111111111111/x.jpg');
    raise exception 'FALHA: B gravou na pasta de A';
  exception when insufficient_privilege then null; end;
end $$;

-- Validação de entrada: reps fora da faixa é rejeitada
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  begin
    insert into public.set_logs (session_id, exercise_key, exercise_name, muscle, set_index, load_kg, reps)
      values ('aaaaaaaa-0000-0000-0000-000000000002','x','x','x',1,10,500);
    raise exception 'FALHA: aceitou 500 reps';
  exception when check_violation then null; end;
end $$;

-- A continua vendo seus dados intactos
do $$ begin
  if (select weight_kg from public.body_metrics) <> 80 then raise exception 'peso de A alterado'; end if;
  if (select count(*) from public.set_logs) <> 1 then raise exception 'séries de A apagadas'; end if;
  if (select count(*) from public.appearance_analyses) <> 1 then raise exception 'análise de A apagada'; end if;
end $$;

-- Anônimo não lê nada
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from public.profiles;
    raise exception 'FALHA: anon leu profiles';
  exception when insufficient_privilege then null; end;
end $$;

-- Exclusão da conta apaga tudo em cascata
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.delete_my_account();
reset role;
do $$ begin
  if (select count(*) from public.set_logs) <> 0 then raise exception 'cascata falhou'; end if;
  if (select count(*) from public.appearance_analyses) <> 0 then raise exception 'cascata (análises) falhou'; end if;
  if (select count(*) from auth.users) <> 1 then raise exception 'usuário não removido'; end if;
end $$;
\echo 'RLS: TODOS OS TESTES PASSARAM'
