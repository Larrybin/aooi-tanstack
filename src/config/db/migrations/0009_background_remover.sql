CREATE TABLE "product_quota_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"site_key" text NOT NULL,
	"product_key" text NOT NULL,
	"product_id" text NOT NULL,
	"operation_key" text NOT NULL,
	"units" integer NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"job_id" text,
	"reason" text,
	"entitlement_grant_ids_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"committed_at" timestamp,
	"refunded_at" timestamp,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "uq_product_quota_idempotency" UNIQUE("idempotency_key")
);
--> statement-breakpoint
INSERT INTO "product_quota_reservation" (
	"id",
	"user_id",
	"anonymous_session_id",
	"site_key",
	"product_key",
	"product_id",
	"operation_key",
	"units",
	"status",
	"idempotency_key",
	"job_id",
	"reason",
	"entitlement_grant_ids_json",
	"created_at",
	"updated_at",
	"committed_at",
	"refunded_at",
	"expires_at"
)
SELECT
	"id",
	"user_id",
	"anonymous_session_id",
	'ai-remover',
	'ai-remover',
	"product_id",
	CASE "quota_type"
		WHEN 'upload' THEN 'upload.create'
		WHEN 'processing' THEN 'image.remove'
		WHEN 'high_res_download' THEN 'image.hd_download'
		ELSE "quota_type"
	END,
	"units",
	"status",
	"idempotency_key",
	"job_id",
	"reason",
	"entitlement_grant_ids_json",
	"created_at",
	"updated_at",
	"committed_at",
	"refunded_at",
	"expires_at"
FROM "remover_quota_reservation";
--> statement-breakpoint
ALTER TABLE "product_quota_reservation" ADD CONSTRAINT "product_quota_reservation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "remover_job" DROP CONSTRAINT IF EXISTS "remover_job_quota_reservation_id_remover_quota_reservation_id_fk";
--> statement-breakpoint
ALTER TABLE "remover_job" ADD CONSTRAINT "remover_job_quota_reservation_id_product_quota_reservation_id_fk" FOREIGN KEY ("quota_reservation_id") REFERENCES "public"."product_quota_reservation"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
DROP TABLE "remover_quota_reservation";
--> statement-breakpoint
CREATE INDEX "idx_product_quota_user_operation_created" ON "product_quota_reservation" USING btree ("user_id","site_key","product_key","operation_key","created_at");
--> statement-breakpoint
CREATE INDEX "idx_product_quota_anonymous_operation_created" ON "product_quota_reservation" USING btree ("anonymous_session_id","site_key","product_key","operation_key","created_at");
--> statement-breakpoint
CREATE INDEX "idx_product_quota_status_expires" ON "product_quota_reservation" USING btree ("status","expires_at");
--> statement-breakpoint
CREATE INDEX "idx_product_quota_job" ON "product_quota_reservation" USING btree ("job_id");
--> statement-breakpoint
CREATE TABLE "background_remover_image" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"original_storage_key" text NOT NULL,
	"result_storage_key" text NOT NULL,
	"original_mime_type" text NOT NULL,
	"result_mime_type" text NOT NULL,
	"original_byte_size" integer NOT NULL,
	"result_byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"status" text NOT NULL,
	"quota_reservation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "background_remover_image" ADD CONSTRAINT "background_remover_image_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "background_remover_image" ADD CONSTRAINT "background_remover_image_quota_reservation_id_product_quota_reservation_id_fk" FOREIGN KEY ("quota_reservation_id") REFERENCES "public"."product_quota_reservation"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_background_remover_image_user_created" ON "background_remover_image" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_background_remover_image_anonymous_created" ON "background_remover_image" USING btree ("anonymous_session_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_background_remover_image_expires" ON "background_remover_image" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "idx_background_remover_image_quota" ON "background_remover_image" USING btree ("quota_reservation_id");
