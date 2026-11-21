-- 2026-11-21 audit (A46): a reminder no device received because the push service failed for now is tried again
-- within its hour, so the worker removes that day's send mark. Only its own rows, under the existing policy.
GRANT DELETE ON reminder_sends TO obur_worker;
