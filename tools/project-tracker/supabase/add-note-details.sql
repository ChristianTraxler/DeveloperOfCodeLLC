-- =========================================================
-- Migration: add an expandable "details" field to notes.
-- Lets a changelog entry carry a brief summary (commit body +
-- files changed) that the Tracker shows when you click the entry.
-- Safe to run on an existing database.
-- =========================================================
alter table notes add column if not exists details text;
