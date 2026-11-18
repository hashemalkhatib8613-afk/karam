\set ON_ERROR_STOP on
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','admin@x'),('00000000-0000-0000-0000-00000000000b','partner@x');
select id::text, role from public.profiles order by role;
-- seed as superuser
insert into media_assets (id,storage_path,thumb_path,mime_type) values
 ('11111111-1111-1111-1111-111111111111','a/pub.jpg','a/pub_t.jpg','image/jpeg'),
 ('22222222-2222-2222-2222-222222222222','a/draft.jpg','a/draft_t.jpg','image/jpeg'),
 ('33333333-3333-3333-3333-333333333333','a/sched.jpg',null,'image/jpeg');
insert into albums (id,slug,title,status,cover_asset_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','live','Live album','published','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000002','draft','Draft album','draft','22222222-2222-2222-2222-222222222222');
insert into albums (slug,title,status,scheduled_at) values ('future','Future','scheduled', now()+interval '1 day'),('past','Past due','scheduled', now()-interval '1 day');
insert into album_media (album_id,media_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222');
insert into storage.objects (bucket_id,name) values ('media','a/pub.jpg'),('media','a/pub_t.jpg'),('media','a/draft.jpg'),('media','a/sched.jpg');
insert into notes (id,title,teaser,body,status) values
 ('bbbbbbbb-0000-0000-0000-000000000001','Open now','t','SECRET-OPEN-BODY','published'),
 ('bbbbbbbb-0000-0000-0000-000000000002','Future','t','SECRET-FUTURE-BODY','published'),
 ('bbbbbbbb-0000-0000-0000-000000000003','Clue','t','SECRET-CLUE-BODY','published'),
 ('bbbbbbbb-0000-0000-0000-000000000004','Draft','t','SECRET-DRAFT-BODY','draft');
update notes set unlock_at = now()+interval '2 days' where title='Future';
insert into surprises (id,title,teaser,message,status,unlock_at,expires_at) values
 ('cccccccc-0000-0000-0000-000000000001','Available surprise','ready','SECRET-AVAILABLE','published',null,null),
 ('cccccccc-0000-0000-0000-000000000002','Future surprise','wait','SECRET-FUTURE','published',now()+interval '1 day',null),
 ('cccccccc-0000-0000-0000-000000000003','Expired surprise','gone','SECRET-EXPIRED','published',null,now()-interval '1 day'),
 ('cccccccc-0000-0000-0000-000000000004','Draft surprise','draft','SECRET-DRAFT','draft',null,null);

-- ===== as ADMIN
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select 'admin sees albums', count(*) from albums;
select set_note_clue('bbbbbbbb-0000-0000-0000-000000000003'::uuid,'Where did we first meet?','  The Cafe ');
select 'admin sees storage', count(*) from storage.objects;
select 'admin sees surprises (expect 4)', count(*) from surprises;
select write_audit('test','note','x','{}'::jsonb);
reset role;

-- ===== as PARTNER
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'P albums (expect live+past = 2)', count(*) from albums;
select 'P draft album visible? (0)', count(*) from albums where slug='draft';
select 'P future album visible? (0)', count(*) from albums where slug='future';
select 'P media (expect pub only = 1)', count(*) from media_assets;
select 'P storage objects (expect pub+thumb = 2)', count(*) from storage.objects;
select 'P notes rows (expect only open = 1)', count(*) from notes;
select 'P bodies leaked', count(*) from notes where body like 'SECRET-FUTURE%' or body like 'SECRET-CLUE%' or body like 'SECRET-DRAFT%';
select 'P note_cards (expect 3: open,future,clue; no draft)', title, state, clue from note_cards order by title;
select 'P surprise rows (expect available only = 1)', count(*) from surprises;
select 'P surprise messages leaked (expect 0)', count(*) from surprises where message like 'SECRET-FUTURE%' or message like 'SECRET-EXPIRED%' or message like 'SECRET-DRAFT%';
select 'P surprise cards (expect available,countdown,expired)', title, state from surprise_cards order by title;
select 'P secrets (0 or error)', count(*) from note_secrets;
select 'wrong answer', unlock_note('bbbbbbbb-0000-0000-0000-000000000003','nope');
select 'notes after wrong (1)', count(*) from notes;
select 'right answer', unlock_note('bbbbbbbb-0000-0000-0000-000000000003','the cafe');
select 'notes after right (2)', count(*) from notes;
select 'future unlock attempt', unlock_note('bbbbbbbb-0000-0000-0000-000000000002','x');
select 'complete onboarding', complete_onboarding();
select 'profile role after', role from profiles where id = auth.uid();
do $$ begin begin update profiles set role='admin' where id = auth.uid(); raise notice 'role update rows affected check below'; end; end $$;
select 'partner still partner', role from profiles where id='00000000-0000-0000-0000-00000000000b';
do $$ begin begin insert into albums (slug,title) values ('hack','hack'); raise exception 'PARTNER INSERT SUCCEEDED'; exception when insufficient_privilege or others then raise notice 'insert blocked: %', sqlerrm; end; end $$;
do $$ begin begin insert into storage.objects (bucket_id,name) values ('media','evil.jpg'); raise exception 'PARTNER UPLOAD SUCCEEDED'; exception when others then raise notice 'upload blocked: %', sqlerrm; end; end $$;
do $$ begin begin perform set_note_clue('bbbbbbbb-0000-0000-0000-000000000003'::uuid,'x','y'); raise exception 'PARTNER SET CLUE SUCCEEDED'; exception when others then raise notice 'set_note_clue blocked: %', sqlerrm; end; end $$;
do $$ begin begin perform write_audit('a','b','c'); raise exception 'PARTNER AUDIT SUCCEEDED'; exception when others then raise notice 'audit blocked: %', sqlerrm; end; end $$;
insert into reactions (target_type,target_id) values ('media','11111111-1111-1111-1111-111111111111');
select 'P reactions (1)', count(*) from reactions;
select 'P audit rows (0)', count(*) from audit_logs;
reset role;

-- ===== as ANON
set role anon;
select 'anon login settings', site_name from public_login_settings;
do $$ begin begin perform count(*) from albums; raise exception 'ANON READ ALBUMS OK?'; exception when insufficient_privilege then raise notice 'anon albums blocked'; end; end $$;
do $$ begin begin perform count(*) from note_cards; raise exception 'ANON NOTE_CARDS OK?'; exception when insufficient_privilege then raise notice 'anon note_cards blocked'; end; end $$;
do $$ begin begin perform count(*) from surprise_cards; raise exception 'ANON SURPRISE_CARDS OK?'; exception when insufficient_privilege then raise notice 'anon surprise cards blocked'; end; end $$;
do $$ begin begin perform count(*) from site_settings; raise exception 'ANON SETTINGS OK?'; exception when insufficient_privilege then raise notice 'anon settings blocked'; end; end $$;
reset role;
