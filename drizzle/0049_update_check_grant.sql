-- An admin may turn the check for new versions on or off, and the answer is stored with it (the existing
-- household_settings_admin policy limits changes to active admins).
GRANT UPDATE (update_check, latest_version, latest_checked_at) ON household_settings TO obur_app;
