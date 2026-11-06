CREATE TABLE IF NOT EXISTS "centros_coste" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"formato_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "centros_coste_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "formatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "formatos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lineas_telefonicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" varchar(20) NOT NULL,
	"numero_original" varchar(50) NOT NULL,
	"proveedor" varchar(100) DEFAULT '' NOT NULL,
	"centro_coste_id" uuid NOT NULL,
	"fecha_asignacion" date NOT NULL,
	"costo_mensual" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tipo_linea" varchar(10) NOT NULL,
	"empleado" varchar(100),
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"tipo_uso" varchar(20) DEFAULT 'personal' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "centros_coste" ADD CONSTRAINT "fk_centro_formato" FOREIGN KEY ("formato_id") REFERENCES "public"."formatos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineas_telefonicas" ADD CONSTRAINT "fk_linea_centro" FOREIGN KEY ("centro_coste_id") REFERENCES "public"."centros_coste"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_centro_formato" ON "centros_coste" USING btree ("formato_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_linea_numero_activa" ON "lineas_telefonicas" USING btree ("numero") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_linea_centro_coste" ON "lineas_telefonicas" USING btree ("centro_coste_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_linea_estado" ON "lineas_telefonicas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_linea_tipo_uso" ON "lineas_telefonicas" USING btree ("tipo_uso");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_linea_fecha_asignacion" ON "lineas_telefonicas" USING btree ("fecha_asignacion");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_linea_proveedor" ON "lineas_telefonicas" USING btree ("proveedor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_linea_empleado" ON "lineas_telefonicas" USING btree ("empleado");
--> statement-breakpoint
-- Añadido manualmente: drizzle-kit 0.24.2 no serializa constraints CHECK (las ignora al generar).
-- Las definiciones viven en src/infrastructure/database/schema/lineas-telefonicas.ts.
DO $$ BEGIN
 ALTER TABLE "lineas_telefonicas" ADD CONSTRAINT "ck_linea_costo_mensual" CHECK ("costo_mensual" >= 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineas_telefonicas" ADD CONSTRAINT "ck_linea_tipo_linea" CHECK ("tipo_linea" IN ('movil', 'fijo'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineas_telefonicas" ADD CONSTRAINT "ck_linea_estado" CHECK ("estado" IN ('activa', 'baja', 'pendiente', 'portabilidad'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineas_telefonicas" ADD CONSTRAINT "ck_linea_tipo_uso" CHECK ("tipo_uso" IN ('personal', 'geovictoria'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;