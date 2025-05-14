-- Migration to add packaging reminder fields to the orders table

alter table public.orders
  add column if not exists required_packaging_materials text[];

alter table public.orders
  add column if not exists packaging_reminder_trigger_stage_id uuid
  references public.workflow_stages(id) on delete set null;

alter table public.orders
  add column if not exists packaging_reminder_trigger_sub_stage_id uuid
  references public.workflow_sub_stages(id) on delete set null;

alter table public.orders
  add column if not exists packaging_reminder_sent boolean not null default false; 