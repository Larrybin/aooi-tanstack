ALTER TABLE "text_to_speech_generation" ADD COLUMN "quota_reservation_id" text;
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD COLUMN "credit_id" text;
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD COLUMN "charged_characters" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD COLUMN "monthly_quota_characters" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD COLUMN "extra_credit_characters" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD CONSTRAINT "text_to_speech_generation_quota_reservation_id_product_quota_reservation_id_fk" FOREIGN KEY ("quota_reservation_id") REFERENCES "public"."product_quota_reservation"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "text_to_speech_generation" ADD CONSTRAINT "text_to_speech_generation_credit_id_credit_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."credit"("id") ON DELETE set null ON UPDATE no action;
