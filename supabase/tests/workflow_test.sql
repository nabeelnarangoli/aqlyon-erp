-- End-to-end permission & workflow test. Run against a DB with stub + schema applied.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@aq.test','{"full_name":"Nabeel"}'),
 ('00000000-0000-0000-0000-00000000000b','mkt@aq.test','{"full_name":"Marketer","role":"marketer"}'),
 ('00000000-0000-0000-0000-00000000000c','des@aq.test','{"full_name":"Designer","role":"designer"}'),
 ('00000000-0000-0000-0000-00000000000d','fin@aq.test','{"full_name":"Finance","role":"finance"}');
-- simulate the admin-users function activating staff with their roles
update public.profiles set active = true, role = (select (raw_user_meta_data->>'role')::app_role from auth.users u where u.id = profiles.id)
  where exists (select 1 from auth.users u where u.id = profiles.id and u.raw_user_meta_data ? 'role');
select email, role from public.profiles order by email;

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;

-- ===== MARKETER: lead → client → package → task → post
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into leads(id,name,company,phone,source,stage,estimated_value)
  values ('10000000-0000-0000-0000-000000000001','Rahul','Koyilandy Bakes','9999','Instagram','proposal',15000);
insert into interactions(lead_id,type,summary,next_action,next_action_date) values
  ('10000000-0000-0000-0000-000000000001','meeting','Met owner, wants 20 posts/month','Send quote',current_date+1);
select convert_lead('10000000-0000-0000-0000-000000000001') as client_id \gset
select code, name, status from clients;
insert into packages(client_id,name,fee,posts_per_month,reels_per_month,start_date)
  values (:'client_id','Growth Plan',15000,20,4,date_trunc('month',current_date));
insert into design_tasks(id,client_id,title,task_type,assignee_id,due_date)
  values ('20000000-0000-0000-0000-000000000001',:'client_id','Diwali offer post','Social Post','00000000-0000-0000-0000-00000000000c',current_date+2);
insert into content_posts(id,client_id,publish_date,title,status,design_task_id)
  values ('30000000-0000-0000-0000-000000000001',:'client_id',current_date+3,'Diwali offer','client_approval','20000000-0000-0000-0000-000000000001');
insert into approval_links(token,client_id) values ('tok123',:'client_id');
select 'marketer sees invoices count' t, count(*) from invoices;
do $$ begin begin insert into expenses(amount) values (100); raise exception 'FAIL marketer inserted expense';
  exception when insufficient_privilege then raise notice 'ok: marketer blocked from expenses'; end; end $$;
reset role;

-- ===== DESIGNER
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select code, status from design_tasks;
update design_tasks set status='in_progress' where id='20000000-0000-0000-0000-000000000001';
do $$ begin begin update design_tasks set status='approved' where id='20000000-0000-0000-0000-000000000001'; raise exception 'FAIL designer approved';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end; end $$;
insert into task_proofs(task_id,file_path,note) values ('20000000-0000-0000-0000-000000000001','x/v1.png','first draft');
select 'after proof' t, status from design_tasks;
insert into time_logs(task_id,minutes,note) values ('20000000-0000-0000-0000-000000000001',90,'design');
insert into queries(subject,body,to_role,task_id) values ('Need logo PNG','Client logo is low res','marketer','20000000-0000-0000-0000-000000000001');
select 'designer sees clients' t, count(*) from clients;
select 'designer sees leads' t, count(*) from leads;
select 'designer sees invoices' t, count(*) from invoices;
reset role;

-- ===== MARKETER reviews proof
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select subject, status from queries;
insert into query_replies(query_id,body) select id,'Uploaded to Drive' from queries limit 1;
update task_proofs set status='changes_requested', review_note='Bigger headline' where task_id='20000000-0000-0000-0000-000000000001';
select 'after changes' t, status, revision_count from design_tasks;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into task_proofs(task_id,file_path) values ('20000000-0000-0000-0000-000000000001','x/v2.png');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update task_proofs set status='approved' where version=2;
select 'after internal approve' t, status from design_tasks;
reset role;

-- ===== CLIENT via portal (anon)
set role anon;
select jsonb_array_length(portal_get('tok123')->'posts') posts, jsonb_array_length(portal_get('tok123')->'proofs') proofs;
select portal_decide('tok123','post','30000000-0000-0000-0000-000000000001','approved','Looks great');
select portal_decide('tok123','proof',(select (portal_get('tok123')->'proofs'->0->>'id')::uuid),'approved','');
select portal_get('bad')->>'error' as bad_token;
reset role;
select 'after client' t, (select status from design_tasks), (select status from content_posts);

-- ===== FINANCE
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select generate_retainer_invoices(current_date) as generated;
select generate_retainer_invoices(current_date) as generated_again;
select number, total, status from invoices;
update invoices set status='sent';
insert into payments(invoice_id,amount,method) select id, 5000, 'UPI' from invoices;
select 'partial' t, amount_paid, status from invoices;
insert into payments(invoice_id,amount,method) select id, 10000, 'Cash' from invoices;
select 'paid' t, amount_paid, status from invoices;
insert into expenses(category,amount) values ('Software/Subscriptions',1200);
insert into quotations(client_id,items,discount) values (:'client_id','[{"description":"Logo","qty":1,"rate":5000},{"description":"Posts","qty":10,"rate":500}]',1000);
select number, subtotal, total from quotations;
select * from v_monthly_finance;
select 'finance sees tasks' t, count(*) from design_tasks;
select 'finance sees leads' t, count(*) from leads;
reset role;

-- ===== notifications
select p.full_name, n.title from notifications n join profiles p on p.id=n.user_id order by n.created_at;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select 'designer own notifs' t, count(*) from notifications;
do $$ begin begin update profiles set role='admin' where id=auth.uid();
  if (select role from profiles where id=auth.uid())='admin' then raise exception 'FAIL self-promote'; end if;
  exception when insufficient_privilege then null; end;
  raise notice 'ok: designer cannot self-promote'; end $$;
reset role;
-- ===== SUPPLIER COSTS: logo outsourced for 5K, paid 3K + 2K, allocated to client invoice
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into suppliers(id,name,category) values ('40000000-0000-0000-0000-000000000001','Pixel Studio','Freelance Designer');
insert into supplier_bills(id,supplier_id,title,items) values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Logo design','[{"description":"Logo concepts","qty":1,"rate":5000}]');
insert into supplier_bill_allocations(bill_id,client_id,invoice_id,amount) select '50000000-0000-0000-0000-000000000001', client_id, id, 5000 from invoices limit 1;
do $$ begin begin insert into supplier_payments(bill_id,amount) values ('50000000-0000-0000-0000-000000000001',3000); raise exception 'FAIL marketer paid supplier';
  exception when insufficient_privilege then raise notice 'ok: marketer cannot pay suppliers'; end; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into supplier_payments(bill_id,amount,kind) values ('50000000-0000-0000-0000-000000000001',3000,'advance');
select 'supplier partial' t, number, total, amount_paid, status from supplier_bills;
insert into supplier_payments(bill_id,amount,kind) values ('50000000-0000-0000-0000-000000000001',2000,'final');
select 'supplier paid' t, amount_paid, status from supplier_bills;
select direction, kind, amount from v_money_movements order by direction, kind;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select 'designer sees supplier bills' t, count(*) from supplier_bills;
reset role;

-- self-signup with a forged role must NOT get access
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000ff','hacker@x.test','{"role":"admin"}');
do $$ begin
  if (select active or role = 'admin' from public.profiles where id = '00000000-0000-0000-0000-0000000000ff') then raise exception 'FAIL forged role accepted'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ff');
select 'forged user sees clients' t, count(*) from clients;
reset role;
select 'ALL TESTS PASSED' as result;
