-- The app may record on its own profile row that the offer to switch to maintenance was declined (RLS limits it to
-- that row).
GRANT UPDATE (maintain_offer_declined_kg) ON profiles TO obur_app;
