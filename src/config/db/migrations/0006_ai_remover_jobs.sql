CREATE TABLE "remover_image_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remover_quota_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"product_id" text NOT NULL,
	"quota_type" text NOT NULL,
	"units" integer NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"job_id" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"committed_at" timestamp,
	"refunded_at" timestamp,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "uq_remover_quota_idempotency" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "remover_job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_task_id" text,
	"status" text NOT NULL,
	"input_image_asset_id" text NOT NULL,
	"mask_image_asset_id" text NOT NULL,
	"input_image_key" text NOT NULL,
	"mask_image_key" text NOT NULL,
	"output_image_key" text,
	"thumbnail_key" text,
	"cost_units" integer DEFAULT 1 NOT NULL,
	"quota_reservation_id" text NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remover_image_asset" ADD CONSTRAINT "remover_image_asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "remover_quota_reservation" ADD CONSTRAINT "remover_quota_reservation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "remover_job" ADD CONSTRAINT "remover_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "remover_job" ADD CONSTRAINT "remover_job_input_image_asset_id_remover_image_asset_id_fk" FOREIGN KEY ("input_image_asset_id") REFERENCES "public"."remover_image_asset"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "remover_job" ADD CONSTRAINT "remover_job_mask_image_asset_id_remover_image_asset_id_fk" FOREIGN KEY ("mask_image_asset_id") REFERENCES "public"."remover_image_asset"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "remover_job" ADD CONSTRAINT "remover_job_quota_reservation_id_remover_quota_reservation_id_fk" FOREIGN KEY ("quota_reservation_id") REFERENCES "public"."remover_quota_reservation"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_remover_asset_user_created" ON "remover_image_asset" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_asset_anonymous_created" ON "remover_image_asset" USING btree ("anonymous_session_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_asset_expires" ON "remover_image_asset" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_quota_user_type_created" ON "remover_quota_reservation" USING btree ("user_id","quota_type","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_quota_anonymous_type_created" ON "remover_quota_reservation" USING btree ("anonymous_session_id","quota_type","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_quota_status_expires" ON "remover_quota_reservation" USING btree ("status","expires_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_job_user_created" ON "remover_job" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_job_anonymous_created" ON "remover_job" USING btree ("anonymous_session_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_job_status_created" ON "remover_job" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "idx_remover_job_provider_task" ON "remover_job" USING btree ("provider","provider_task_id");
--> statement-breakpoint
CREATE INDEX "idx_remover_job_expires" ON "remover_job" USING btree ("expires_at");
