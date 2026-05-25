-- =========================================================
-- Migration: add an "in_production" flag to projects.
-- Independent of status — flip it on when a project is actually
-- live, so the Tracker can show a pulsing "LIVE" badge alongside
-- the lifecycle status (e.g. still "active" AND in production).
-- Safe to run on an existing database.
-- =========================================================
alter table projects add column if not exists in_production boolean not null default false;
