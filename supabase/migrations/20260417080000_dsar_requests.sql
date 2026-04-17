-- DSAR (Data Subject Access Request) intake queue.
--
-- This table is an OPS QUEUE, not a user-facing table. It records every
-- privacy request (export or delete) submitted through POST /api/dsar.
-- Anyone — including users whose accounts have been deleted — may file a
-- DSAR, so rows may reference email addresses that are not present in any
-- other table.
--
-- Fulfillment (actual export archives, actual account deletions) is handled
-- asynchronously by a privileged ops process that reads this queue. The
-- application layer only writes to it.
--
-- RLS is enabled with ZERO policies, which denies all access via the anon
-- and authenticated roles. Only the service_role key (used by the server
-- DSAR route and by ops tooling) can read or write this table.

create table if not exists public.dsar_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  notes text
);

comment on table public.dsar_requests is
  'Ops queue for privacy requests (GDPR/CCPA access + deletion). '
  'Service-role only. Not user-facing. Rows may reference deleted accounts.';

comment on column public.dsar_requests.email is
  'Email address of the requester, lower-cased by the API layer.';
comment on column public.dsar_requests.request_type is
  'Type of DSAR: export (data portability / access) or delete (erasure).';
comment on column public.dsar_requests.status is
  'Workflow state. Transitions are managed by the ops fulfillment process.';
comment on column public.dsar_requests.notes is
  'Free-form ops notes about handling (e.g., ticket links, dispositions).';

-- Index for the rate-limit query in POST /api/dsar, which counts recent
-- requests for a given email.
create index if not exists dsar_requests_email_created_at_idx
  on public.dsar_requests (email, created_at desc);

-- Secondary index to let ops tooling scan the queue by state.
create index if not exists dsar_requests_status_created_at_idx
  on public.dsar_requests (status, created_at);

alter table public.dsar_requests enable row level security;

-- Intentionally NO policies. With RLS enabled and no policies, the anon and
-- authenticated roles cannot select, insert, update, or delete. Only the
-- service_role bypasses RLS and can operate on this table.
