CREATE TABLE "pronunciation_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"original_text" text NOT NULL,
	"transcription" text,
	"score" numeric(4, 3),
	"missed_words" text[] DEFAULT '{}'::text[] NOT NULL,
	"correct_words" text[] DEFAULT '{}'::text[] NOT NULL,
	"extra_words" text[] DEFAULT '{}'::text[] NOT NULL,
	"audio_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pronunciation_entries" ADD CONSTRAINT "pronunciation_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation_entries" ADD CONSTRAINT "pronunciation_entries_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pronunciation_user_habit" ON "pronunciation_entries" USING btree ("user_id","habit_id");--> statement-breakpoint
CREATE INDEX "idx_pronunciation_entry_date" ON "pronunciation_entries" USING btree ("habit_id","entry_date");
