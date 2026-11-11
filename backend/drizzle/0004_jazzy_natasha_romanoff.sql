CREATE TABLE "game_leaderboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"score" integer NOT NULL,
	"grade" text NOT NULL,
	"weeks" integer NOT NULL,
	"users" integer NOT NULL,
	"outcome" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_leaderboard_name_length" CHECK (char_length("game_leaderboard"."name") between 1 and 16),
	CONSTRAINT "game_leaderboard_score_range" CHECK ("game_leaderboard"."score" between 0 and 100),
	CONSTRAINT "game_leaderboard_grade" CHECK ("game_leaderboard"."grade" in ('S', 'A', 'B', 'C', 'D')),
	CONSTRAINT "game_leaderboard_weeks_range" CHECK ("game_leaderboard"."weeks" between 0 and 520),
	CONSTRAINT "game_leaderboard_users_range" CHECK ("game_leaderboard"."users" between 0 and 1000000000),
	CONSTRAINT "game_leaderboard_outcome" CHECK ("game_leaderboard"."outcome" in ('won', 'bankrupt', 'deadline', 'unfinished'))
);
--> statement-breakpoint
CREATE INDEX "game_leaderboard_rank_idx" ON "game_leaderboard" USING btree ("score" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "game_leaderboard_created_idx" ON "game_leaderboard" USING btree ("created_at");