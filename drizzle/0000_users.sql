CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "users_role_valid" CHECK ("users"."role" in ('admin', 'member')),
	CONSTRAINT "users_display_name_length" CHECK (char_length("users"."display_name") between 1 and 80)
);
