CREATE TYPE "public"."proficiency" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TABLE "dialogue_turns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dialogue_turns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"turn" integer NOT NULL,
	"player_text" text NOT NULL,
	"npc_text" text NOT NULL,
	"completed_objectives" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dialogue_turns_session_turn_key" UNIQUE("session_id","turn")
);
--> statement-breakpoint
CREATE TABLE "mission_reports" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"overall" integer NOT NULL,
	"xp_earned" integer NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_reports_overall_range" CHECK ("mission_reports"."overall" between 0 and 100),
	CONSTRAINT "mission_reports_xp_non_negative" CHECK ("mission_reports"."xp_earned" >= 0)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"target_language" text NOT NULL,
	"level" "proficiency" DEFAULT 'beginner' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_xp_non_negative" CHECK ("players"."xp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"language" text NOT NULL,
	"level" "proficiency" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dialogue_turns" ADD CONSTRAINT "dialogue_turns_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_reports" ADD CONSTRAINT "mission_reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_player_started_idx" ON "sessions" USING btree ("player_id","started_at");