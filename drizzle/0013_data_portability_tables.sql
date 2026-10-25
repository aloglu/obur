CREATE TABLE "account_deletions" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"by" text NOT NULL,
	CONSTRAINT "account_deletions_by_valid" CHECK ("account_deletions"."by" in ('self', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "import_files" (
	"user_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" jsonb NOT NULL,
	CONSTRAINT "import_files_user_id_sha256_pk" PRIMARY KEY("user_id","sha256"),
	CONSTRAINT "import_files_sha256_hex" CHECK ("import_files"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "import_identities" (
	"user_id" uuid NOT NULL,
	"source_install" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"local_id" uuid NOT NULL,
	CONSTRAINT "import_identities_user_id_source_install_kind_source_id_pk" PRIMARY KEY("user_id","source_install","kind","source_id"),
	CONSTRAINT "import_identities_kind_valid" CHECK ("import_identities"."kind" in ('food', 'diary', 'weight', 'water', 'activity', 'target')),
	CONSTRAINT "import_identities_source_id_length" CHECK (char_length("import_identities"."source_id") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "installation" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installation_singleton" CHECK ("installation"."singleton")
);
--> statement-breakpoint
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_identities" ADD CONSTRAINT "import_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;