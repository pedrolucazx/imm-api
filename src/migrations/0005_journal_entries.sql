CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"content" text NOT NULL,
	"word_count" smallint,
	"ui_language_snap" varchar(10),
	"target_skill_snap" varchar(20),
	"ai_feedback" jsonb,
	"ai_agent_type" varchar(30),
	"mood_score" smallint,
	"energy_score" smallint,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
	CONSTRAINT "journal_entries_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal" ON "journal_entries"("user_id", "habit_id", "entry_date");--> statement-breakpoint
CREATE INDEX "idx_journal_ai_gin" ON "journal_entries" USING gin ("ai_feedback");
