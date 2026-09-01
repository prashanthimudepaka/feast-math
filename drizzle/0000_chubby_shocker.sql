CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"cuisine" text NOT NULL,
	"meal_type" text NOT NULL,
	"serving_style" text NOT NULL,
	"event_date" date,
	"serve_time" text,
	"adults" integer DEFAULT 0 NOT NULL,
	"kids" integer DEFAULT 0 NOT NULL,
	"appetite_profile" jsonb,
	"dietary_notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"dish_name" text NOT NULL,
	"predicted_qty" numeric(10, 2),
	"unit" text,
	"verdict" text NOT NULL,
	"actual_qty" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"params" jsonb NOT NULL,
	"computed" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"role" text DEFAULT 'family' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shares_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"pack_suggestion" text,
	"checked" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_user_idx" ON "events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_event_version_idx" ON "plans" USING btree ("event_id","version");