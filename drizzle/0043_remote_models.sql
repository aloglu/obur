CREATE TABLE "household_settings" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"personal_keys" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_settings_singleton" CHECK ("household_settings"."singleton")
);
--> statement-breakpoint
CREATE TABLE "model_choices" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"speak" text DEFAULT 'server' NOT NULL,
	"scan" text DEFAULT 'server' NOT NULL,
	"speak_allowed_at" timestamp with time zone,
	"scan_allowed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_choices_speak_valid" CHECK ("model_choices"."speak" in ('server', 'openai', 'openrouter')),
	CONSTRAINT "model_choices_scan_valid" CHECK ("model_choices"."scan" in ('server', 'openai', 'openrouter')),
	CONSTRAINT "model_choices_allowed" CHECK (("model_choices"."speak" = 'server' or "model_choices"."speak_allowed_at" is not null) and ("model_choices"."scan" = 'server' or "model_choices"."scan_allowed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "model_keys" (
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"ciphertext" text NOT NULL,
	"last4" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_keys_user_id_provider_pk" PRIMARY KEY("user_id","provider"),
	CONSTRAINT "model_keys_provider_valid" CHECK ("model_keys"."provider" in ('openai', 'openrouter')),
	CONSTRAINT "model_keys_sizes" CHECK (length("model_keys"."ciphertext") <= 2048 and length("model_keys"."last4") between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "model_usage" (
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"provider" text NOT NULL,
	"feature" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "model_usage_user_id_month_provider_feature_pk" PRIMARY KEY("user_id","month","provider","feature"),
	CONSTRAINT "model_usage_provider_valid" CHECK ("model_usage"."provider" in ('openai', 'openrouter')),
	CONSTRAINT "model_usage_feature_valid" CHECK ("model_usage"."feature" in ('speak', 'scan')),
	CONSTRAINT "model_usage_count" CHECK ("model_usage"."count" >= 0),
	CONSTRAINT "model_usage_month_start" CHECK (extract(day from "model_usage"."month") = 1)
);
--> statement-breakpoint
ALTER TABLE "model_choices" ADD CONSTRAINT "model_choices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_keys" ADD CONSTRAINT "model_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage" ADD CONSTRAINT "model_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;