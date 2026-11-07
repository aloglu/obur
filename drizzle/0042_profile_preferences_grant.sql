-- The app may change the settings on its own profile row (RLS limits it to that row).
GRANT UPDATE (theme_mode, palette, time_format, scan_log_after, weight_view, voice_off_seen, hold_hint_seen,
	preferences_saved_at) ON profiles TO obur_app;
