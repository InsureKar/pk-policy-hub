
create type public.uw_class as enum ('motor','health','life','fire','marine','engineering','liability','guarantee','misc','other');
create type public.uw_status as enum ('draft','submitted','underwriting_review','information_required','quotation_requested','quotation_received','quotation_shared','customer_accepted','proposal_requested','proposal_received','covernote_requested','covernote_issued','payment_pending','payment_received','policy_requested','policy_issued','completed','won');
create type public.uw_req_status as enum ('pending','received','not_applicable','rejected','expired');

create sequence if not exists public.uw_number_seq;

create table public.underwriting_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text unique,
  client_id uuid references public.clients(id) on delete set null,
  client_type text,
  insurance_class public.uw_class not null default 'other',
  guarantee_request_type text,
  product text,
  insurer_id uuid references public.insurance_companies(id) on delete set null,
  agent_id uuid not null default auth.uid(),
  team_id uuid,
  request_date date not null default current_date,
  required_from date,
  required_until date,
  estimated_premium numeric(14,2) default 0,
  sum_insured numeric(14,2) default 0,
  coverage_required text,
  previous_insurer text,
  existing_policy_number text,
  business_type text default 'new',
  client_contact text,
  remarks text,
  requirement_details text,
  details jsonb not null default '{}'::jsonb,
  status public.uw_status not null default 'draft',
  payment_received boolean not null default false,
  payment_date date,
  premium numeric(14,2),
  policy_number text,
  deal_id uuid references public.deals(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.underwriting_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.underwriting_requests(id) on delete cascade,
  name text not null,
  doc_type text,
  file_path text,
  status text not null default 'received',
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.underwriting_activity (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.underwriting_requests(id) on delete cascade,
  actor_id uuid default auth.uid(),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table public.underwriting_requirement_templates (
  id uuid primary key default gen_random_uuid(),
  insurance_class public.uw_class not null,
  variant text,
  label text not null,
  mandatory boolean not null default true,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.underwriting_request_requirements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.underwriting_requests(id) on delete cascade,
  label text not null,
  mandatory boolean not null default true,
  status public.uw_req_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.underwriting_requests to authenticated;
grant select, insert, update, delete on public.underwriting_documents to authenticated;
grant select, insert on public.underwriting_activity to authenticated;
grant select, insert, update, delete on public.underwriting_requirement_templates to authenticated;
grant select, insert, update, delete on public.underwriting_request_requirements to authenticated;
grant all on public.underwriting_requests, public.underwriting_documents, public.underwriting_activity, public.underwriting_requirement_templates, public.underwriting_request_requirements to service_role;
grant usage, select on sequence public.uw_number_seq to authenticated, service_role;

create or replace function public.can_view_uw(_req uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.underwriting_requests r
    where r.id = _req and (
      public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'management')
      or r.agent_id = auth.uid() or r.created_by = auth.uid()
      or (r.team_id is not null and r.team_id = public.current_user_team())
    )
  )
$$;
revoke execute on function public.can_view_uw(uuid) from anon;

alter table public.underwriting_requests enable row level security;
alter table public.underwriting_documents enable row level security;
alter table public.underwriting_activity enable row level security;
alter table public.underwriting_requirement_templates enable row level security;
alter table public.underwriting_request_requirements enable row level security;

create policy uw_select on public.underwriting_requests for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'management')
         or agent_id = auth.uid() or created_by = auth.uid()
         or (team_id is not null and team_id = public.current_user_team()));
create policy uw_insert on public.underwriting_requests for insert to authenticated
  with check (created_by = auth.uid());
create policy uw_update on public.underwriting_requests for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'management') or agent_id = auth.uid() or created_by = auth.uid());
create policy uw_delete on public.underwriting_requests for delete to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'management'));

create policy uwdoc_select on public.underwriting_documents for select to authenticated using (public.can_view_uw(request_id));
create policy uwdoc_insert on public.underwriting_documents for insert to authenticated with check (public.can_view_uw(request_id));
create policy uwdoc_update on public.underwriting_documents for update to authenticated using (public.can_view_uw(request_id));
create policy uwdoc_delete on public.underwriting_documents for delete to authenticated using (public.can_view_uw(request_id));

create policy uwact_select on public.underwriting_activity for select to authenticated using (public.can_view_uw(request_id));
create policy uwact_insert on public.underwriting_activity for insert to authenticated with check (public.can_view_uw(request_id));

create policy uwreq_select on public.underwriting_request_requirements for select to authenticated using (public.can_view_uw(request_id));
create policy uwreq_insert on public.underwriting_request_requirements for insert to authenticated with check (public.can_view_uw(request_id));
create policy uwreq_update on public.underwriting_request_requirements for update to authenticated using (public.can_view_uw(request_id));
create policy uwreq_delete on public.underwriting_request_requirements for delete to authenticated using (public.can_view_uw(request_id));

create policy uwtpl_select on public.underwriting_requirement_templates for select to authenticated using (true);
create policy uwtpl_write on public.underwriting_requirement_templates for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'management'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'management'));

create or replace function public.tg_uw_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.request_no is null then
    new.request_no := 'UW-' || lpad(nextval('public.uw_number_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  if new.team_id is null then
    new.team_id := public.current_user_team();
  end if;
  if new.payment_received and new.payment_date is null then
    new.payment_date := current_date;
  end if;
  return new;
end $$;
revoke execute on function public.tg_uw_before() from anon, authenticated;

create trigger uw_before before insert or update on public.underwriting_requests
  for each row execute function public.tg_uw_before();

create or replace function public.tg_uw_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.underwriting_activity(request_id, actor_id, action, detail)
    values (new.id, auth.uid(), 'Request Created', 'Underwriting request created');
  else
    if new.status is distinct from old.status then
      insert into public.underwriting_activity(request_id, actor_id, action, detail)
      values (new.id, auth.uid(), 'Stage Changed', old.status::text || ' → ' || new.status::text);
    end if;
    if new.payment_received and not old.payment_received then
      insert into public.underwriting_activity(request_id, actor_id, action, detail)
      values (new.id, auth.uid(), 'Payment Received', 'Payment confirmed');
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.tg_uw_after() from anon, authenticated;

create trigger uw_after after insert or update on public.underwriting_requests
  for each row execute function public.tg_uw_after();

create or replace function public.tg_uw_doc_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.underwriting_activity(request_id, actor_id, action, detail)
  values (new.request_id, auth.uid(), 'Document Uploaded', new.name);
  return new;
end $$;
revoke execute on function public.tg_uw_doc_after() from anon, authenticated;

create trigger uw_doc_after after insert on public.underwriting_documents
  for each row execute function public.tg_uw_doc_after();

create index on public.underwriting_requests(agent_id);
create index on public.underwriting_requests(status);
create index on public.underwriting_documents(request_id);
create index on public.underwriting_activity(request_id);
create index on public.underwriting_request_requirements(request_id);

insert into public.underwriting_requirement_templates (insurance_class, variant, label, mandatory, sort_order) values
('marine', null, 'Performa Invoice', true, 1),
('marine', null, 'Bank Name', true, 2),
('marine', null, 'Bank Location / Branch', true, 3),
('marine', null, 'Client Email / Request', false, 4),
('marine', null, 'Contract', false, 5),
('fire', null, 'Nature of Business', true, 1),
('fire', null, 'Location / Complete Address', true, 2),
('fire', null, 'Building Status', true, 3),
('fire', null, 'Stock Details', true, 4),
('fire', null, 'Machinery Details', true, 5),
('fire', null, 'Loss History', false, 6),
('guarantee', 'quotation', 'Company Profile', true, 1),
('guarantee', 'quotation', 'NTN Certificate', true, 2),
('guarantee', 'quotation', 'Letter of Award / Contract', true, 3),
('guarantee', 'issuance', 'Copy of Letter of Award', true, 1),
('guarantee', 'issuance', 'Company Profile', true, 2),
('guarantee', 'issuance', 'Last 1 Year Bank Statement', true, 3),
('guarantee', 'issuance', 'Pakistan Engineering Council Certificate', true, 4),
('guarantee', 'issuance', 'Written Request for Bond on Client Letterhead', true, 5),
('guarantee', 'issuance', '2 x CNIC Copies of Authorized Signatory', true, 6),
('guarantee', 'issuance', 'NTN Certificate of Party', true, 7),
('guarantee', 'issuance', 'Undated Cheque of Guarantee Amount', true, 8),
('guarantee', 'issuance', 'Premium & Cash Margin as advised by Insurer', true, 9),
('motor', null, 'Client Email / Request', false, 1),
('motor', null, 'Existing Policy', false, 2),
('health', null, 'Employee Data / Census', false, 1),
('health', null, 'Existing Policy', false, 2),
('life', null, 'Client Email / Request', false, 1),
('engineering', null, 'Contract / Specifications', false, 1),
('liability', null, 'Client Email / Request', false, 1),
('misc', null, 'Supporting Documents', false, 1),
('other', null, 'Supporting Documents', false, 1);

create trigger uw_tpl_updated before update on public.underwriting_requirement_templates
  for each row execute function public.tg_set_updated_at();
create trigger uw_reqitem_updated before update on public.underwriting_request_requirements
  for each row execute function public.tg_set_updated_at();
