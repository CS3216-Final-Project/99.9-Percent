CREATE TABLE "game_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_feedback_message_length" CHECK (char_length(btrim("game_feedback"."message")) between 1 and 2000),
	CONSTRAINT "game_feedback_mode" CHECK ("game_feedback"."mode" in ('campaign', 'classic'))
);
