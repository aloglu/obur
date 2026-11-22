ALTER TABLE "profiles" ADD COLUMN "length_unit" text DEFAULT 'cm' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "water_unit" text DEFAULT 'ml' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_length_unit_valid" CHECK ("profiles"."length_unit" in ('cm', 'in'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_water_unit_valid" CHECK ("profiles"."water_unit" in ('ml', 'floz'));