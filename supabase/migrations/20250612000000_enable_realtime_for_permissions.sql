-- This migration enables replication on the worker_permissions table,
-- which is necessary for Supabase Realtime to broadcast changes.
-- Set the replica identity to FULL to include old records in broadcasts
ALTER TABLE public.worker_permissions REPLICA IDENTITY FULL;

-- Add the table to the Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_permissions;