CREATE TABLE "achievements" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"level" text NOT NULL,
	"achieved_on" date NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_user_id_kind_level_pk" PRIMARY KEY("user_id","kind","level"),
	CONSTRAINT "achievements_kind" CHECK ("achievements"."kind" in ('weight', 'goal', 'streak', 'first')),
	CONSTRAINT "achievements_level" CHECK (("achievements"."kind" in ('weight', 'goal') and "achievements"."level" ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$')
				or ("achievements"."kind" = 'streak' and "achievements"."level" ~ '^[0-9]{1,4}$')
				or ("achievements"."kind" = 'first' and "achievements"."level" in ('scan', 'voice', 'recipe')))
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;