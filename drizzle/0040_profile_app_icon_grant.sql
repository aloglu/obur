-- The app may set the chosen Home Screen icon on its own profile row (RLS limits it to that row).
GRANT UPDATE (app_icon) ON profiles TO obur_app;
