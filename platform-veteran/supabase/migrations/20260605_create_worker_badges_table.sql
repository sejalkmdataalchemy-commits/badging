-- Migration: Ensure unique badge records for Platform Veteran Badge system
-- The worker_badges table already exists in this project.

CREATE UNIQUE INDEX IF NOT EXISTS worker_badges_unique_worker_badge_id ON public.worker_badges (worker_id, badge_id);
