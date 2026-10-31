-- Reminder settings, push subscriptions and the send log are private to their person. The app manages settings and
-- subscriptions; the worker acts per person under that person's identity (reads their subscriptions, records what it
-- sent, notes delivery or removes a subscription the push service says is gone).
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY reminder_settings_owner ON reminder_settings TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY reminder_settings_own ON reminder_settings FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON reminder_settings TO obur_app;
GRANT UPDATE (zone, breakfast, lunch, dinner, weigh_in, day_complete, quiet_start, quiet_end, updated_at)
	ON reminder_settings TO obur_app;
--> statement-breakpoint

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY push_subscriptions_owner ON push_subscriptions TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY push_subscriptions_own ON push_subscriptions FOR ALL TO obur_app, obur_worker
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO obur_app;
GRANT UPDATE (p256dh, auth) ON push_subscriptions TO obur_app;
GRANT SELECT, DELETE ON push_subscriptions TO obur_worker;
GRANT UPDATE (last_sent_at, failures) ON push_subscriptions TO obur_worker;
--> statement-breakpoint

ALTER TABLE reminder_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_sends FORCE ROW LEVEL SECURITY;
CREATE POLICY reminder_sends_owner ON reminder_sends TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY reminder_sends_own ON reminder_sends FOR ALL TO obur_worker
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON reminder_sends TO obur_worker;
--> statement-breakpoint

-- For the worker: who has a reminder on and a device to send to, with their settings (no diary data). Disabled
-- accounts are left out.
CREATE FUNCTION app_reminder_candidates()
	RETURNS TABLE (
		user_id uuid, zone text, breakfast time, lunch time, dinner time, weigh_in time, day_complete time,
		quiet_start time, quiet_end time
	)
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
	SELECT s.user_id, s.zone, s.breakfast, s.lunch, s.dinner, s.weigh_in, s.day_complete, s.quiet_start, s.quiet_end
	FROM reminder_settings s
	JOIN users u ON u.id = s.user_id AND u.disabled_at IS NULL
	WHERE num_nonnulls(s.breakfast, s.lunch, s.dinner, s.weigh_in, s.day_complete) > 0
		AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id)
	$$;
REVOKE ALL ON FUNCTION app_reminder_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_reminder_candidates() TO obur_worker;
