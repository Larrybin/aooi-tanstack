CREATE TABLE "text_to_speech_generation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"status" text NOT NULL,
	"text_preview" text NOT NULL,
	"character_count" integer NOT NULL,
	"language" text NOT NULL,
	"voice" text NOT NULL,
	"model" text NOT NULL,
	"output_format" text NOT NULL,
	"request_hash" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD CONSTRAINT "text_to_speech_generation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_tts_generation_user_created" ON "text_to_speech_generation" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_tts_generation_anonymous_created" ON "text_to_speech_generation" USING btree ("anonymous_session_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_tts_generation_hash_expires" ON "text_to_speech_generation" USING btree ("request_hash","expires_at");
--> statement-breakpoint
CREATE INDEX "idx_tts_generation_expires" ON "text_to_speech_generation" USING btree ("expires_at");
