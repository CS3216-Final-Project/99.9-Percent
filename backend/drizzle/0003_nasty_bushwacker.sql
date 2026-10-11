CREATE TABLE "game_email_credentials" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_email_credentials_failed_attempts" CHECK ("game_email_credentials"."failed_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "game_email_credentials" ADD CONSTRAINT "game_email_credentials_account_id_game_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."game_accounts"("id") ON DELETE cascade ON UPDATE no action;