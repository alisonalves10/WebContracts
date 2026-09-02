CREATE TABLE "holidays" (
	"date" date PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"scope" varchar(40) DEFAULT 'national' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
