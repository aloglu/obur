-- The worker records when a reminder device last failed, so a failure is counted at most once a day (2026-11-22
-- Gemini audit, G06: retries every five minutes counted each, and a short outage removed the device).
GRANT UPDATE (failed_at) ON push_subscriptions TO obur_worker;
