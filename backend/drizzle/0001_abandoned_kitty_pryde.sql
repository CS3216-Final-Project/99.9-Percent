CREATE TABLE "game_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_accounts_identity_key" UNIQUE("issuer","subject")
);
--> statement-breakpoint
CREATE TABLE "game_auth_attempts" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"binding_hash" text NOT NULL,
	"nonce" text NOT NULL,
	"verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"envelope" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_runs_positive_revision" CHECK ("game_runs"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_runs" ADD CONSTRAINT "game_runs_account_id_game_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."game_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_account_id_game_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."game_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_runs_owner_updated_idx" ON "game_runs" USING btree ("account_id","updated_at");--> statement-breakpoint
CREATE INDEX "game_sessions_account_idx" ON "game_sessions" USING btree ("account_id");