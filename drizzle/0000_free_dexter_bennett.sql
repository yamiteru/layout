CREATE TABLE "bigram" (
	"file_id" uuid NOT NULL,
	"value" varchar(2) NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "bigram_file_id_value_pk" PRIMARY KEY("file_id","value")
);
--> statement-breakpoint
CREATE TABLE "chunk" (
	"file_id" uuid NOT NULL,
	"index" bigint NOT NULL,
	CONSTRAINT "chunk_file_id_index_pk" PRIMARY KEY("file_id","index")
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language_id" uuid NOT NULL,
	"name" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "file_language_id_name_unique" UNIQUE("language_id","name")
);
--> statement-breakpoint
CREATE TABLE "language" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "language_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trigram" (
	"file_id" uuid NOT NULL,
	"value" varchar(3) NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "trigram_file_id_value_pk" PRIMARY KEY("file_id","value")
);
--> statement-breakpoint
CREATE TABLE "unigram" (
	"file_id" uuid NOT NULL,
	"value" char NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "unigram_file_id_value_pk" PRIMARY KEY("file_id","value")
);
--> statement-breakpoint
ALTER TABLE "bigram" ADD CONSTRAINT "bigram_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_language_id_language_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."language"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trigram" ADD CONSTRAINT "trigram_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unigram" ADD CONSTRAINT "unigram_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_language_id_index" ON "file" USING btree ("language_id");--> statement-breakpoint
CREATE INDEX "file_name_index" ON "file" USING btree ("name");--> statement-breakpoint
CREATE INDEX "file_done_index" ON "file" USING btree ("done");--> statement-breakpoint
CREATE INDEX "language_name_index" ON "language" USING btree ("name");--> statement-breakpoint
CREATE INDEX "language_done_index" ON "language" USING btree ("done");