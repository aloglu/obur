CREATE TABLE "day_notes" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"text" text NOT NULL,
	"typed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "day_notes_user_id_local_date_pk" PRIMARY KEY("user_id","local_date"),
	CONSTRAINT "day_notes_length" CHECK (char_length("day_notes"."text") <= 10000)
);
--> statement-breakpoint
ALTER TABLE "day_notes" ADD CONSTRAINT "day_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;