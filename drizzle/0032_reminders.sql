CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "push_subscriptions_user_endpoint" UNIQUE("user_id","endpoint"),
	CONSTRAINT "push_subscriptions_sizes" CHECK (length("push_subscriptions"."endpoint") <= 2048 and length("push_subscriptions"."p256dh") <= 200 and length("push_subscriptions"."auth") <= 100)
);
--> statement-breakpoint
CREATE TABLE "reminder_sends" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"local_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_sends_user_id_kind_local_date_pk" PRIMARY KEY("user_id","kind","local_date"),
	CONSTRAINT "reminder_sends_kind" CHECK ("reminder_sends"."kind" in ('breakfast', 'lunch', 'dinner', 'weigh_in', 'day_complete'))
);
--> statement-breakpoint
CREATE TABLE "reminder_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"zone" text NOT NULL,
	"breakfast" time,
	"lunch" time,
	"dinner" time,
	"weigh_in" time,
	"day_complete" time,
	"quiet_start" time DEFAULT '22:00' NOT NULL,
	"quiet_end" time DEFAULT '08:00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_settings_zone_length" CHECK (length("reminder_settings"."zone") between 1 and 64)
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_sends" ADD CONSTRAINT "reminder_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");