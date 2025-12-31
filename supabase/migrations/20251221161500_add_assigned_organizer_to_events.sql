-- Add assigned_organizer column and related policy/index
-- This migration adds the assigned_organizer column (nullable, FK -> profiles.id),
-- creates an index, and updates the events policy to allow organizers assigned to an event to manage it.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS assigned_organizer uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_assigned_organizer ON public.events (assigned_organizer);

-- Recreate policy to include assigned_organizer in the check
DROP POLICY IF EXISTS "Organizer & admin manage events" ON public.events;

CREATE POLICY "Organizer & admin manage events"
  ON public.events FOR ALL
  USING (
    created_by = auth.uid()
    OR assigned_organizer = auth.uid()
    OR is_admin_by_email()
  );
