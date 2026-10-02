-- Idempotency tracking table for payment provider webhooks (Dodo Payments)
create table if not exists public.processed_webhooks (
  webhook_id text primary key,
  event_type text,
  provider text default 'dodopayments',
  payload jsonb,
  processed_at timestamptz default now()
);

alter table public.processed_webhooks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'processed_webhooks' and policyname = 'processed_webhooks_service_role_all'
  ) then
    create policy processed_webhooks_service_role_all on public.processed_webhooks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
