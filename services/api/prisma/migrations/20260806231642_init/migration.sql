-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'admin');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "malla_id" VARCHAR(10),
    "outlook_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mallas" (
    "id" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "year" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mallas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malla_cursos" (
    "id" VARCHAR(50) NOT NULL,
    "malla_id" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "semestre" INTEGER NOT NULL,
    "es_electivo" BOOLEAN NOT NULL DEFAULT false,
    "electivo_categoria" VARCHAR(50),
    "area" VARCHAR(100),
    "orden_dentro_semestre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "malla_cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malla_prerrequisitos" (
    "curso_id" VARCHAR(50) NOT NULL,
    "prerequisito_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "malla_prerrequisitos_pkey" PRIMARY KEY ("curso_id","prerequisito_id")
);

-- CreateTable
CREATE TABLE "user_cursos_aprobados" (
    "user_id" UUID NOT NULL,
    "malla_curso_id" VARCHAR(50) NOT NULL,
    "aprobado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cursos_aprobados_pkey" PRIMARY KEY ("user_id","malla_curso_id")
);

-- CreateTable
CREATE TABLE "cursos_equivalentes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "malla_origen_id" VARCHAR(10) NOT NULL,
    "curso_origen_id" VARCHAR(50) NOT NULL,
    "malla_destino_id" VARCHAR(10) NOT NULL,
    "curso_destino_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "cursos_equivalentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(50) NOT NULL,
    "subido_por" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_disponibles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" UUID NOT NULL,
    "nrc" VARCHAR(20) NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "seccion" VARCHAR(20),
    "dia" VARCHAR(20) NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fin" VARCHAR(5) NOT NULL,
    "instructor" VARCHAR(255),
    "cupos" INTEGER,
    "liga" VARCHAR(20),
    "conector" VARCHAR(20),
    "electivo_categoria" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_disponibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electivo_categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" UUID NOT NULL,
    "malla_categoria_id" VARCHAR(50) NOT NULL,
    "nombre_display" VARCHAR(100) NOT NULL,
    "nrcs" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "electivo_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_outlook_id_key" ON "users"("outlook_id");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_equivalentes_curso_origen_id_curso_destino_id_key" ON "cursos_equivalentes"("curso_origen_id", "curso_destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "electivo_categorias_periodo_id_malla_categoria_id_key" ON "electivo_categorias"("periodo_id", "malla_categoria_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_malla_id_fkey" FOREIGN KEY ("malla_id") REFERENCES "mallas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malla_cursos" ADD CONSTRAINT "malla_cursos_malla_id_fkey" FOREIGN KEY ("malla_id") REFERENCES "mallas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malla_prerrequisitos" ADD CONSTRAINT "malla_prerrequisitos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "malla_cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malla_prerrequisitos" ADD CONSTRAINT "malla_prerrequisitos_prerequisito_id_fkey" FOREIGN KEY ("prerequisito_id") REFERENCES "malla_cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cursos_aprobados" ADD CONSTRAINT "user_cursos_aprobados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cursos_aprobados" ADD CONSTRAINT "user_cursos_aprobados_malla_curso_id_fkey" FOREIGN KEY ("malla_curso_id") REFERENCES "malla_cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos_equivalentes" ADD CONSTRAINT "cursos_equivalentes_malla_origen_id_fkey" FOREIGN KEY ("malla_origen_id") REFERENCES "mallas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos_equivalentes" ADD CONSTRAINT "cursos_equivalentes_curso_origen_id_fkey" FOREIGN KEY ("curso_origen_id") REFERENCES "malla_cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos_equivalentes" ADD CONSTRAINT "cursos_equivalentes_malla_destino_id_fkey" FOREIGN KEY ("malla_destino_id") REFERENCES "mallas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos_equivalentes" ADD CONSTRAINT "cursos_equivalentes_curso_destino_id_fkey" FOREIGN KEY ("curso_destino_id") REFERENCES "malla_cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos" ADD CONSTRAINT "periodos_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_disponibles" ADD CONSTRAINT "horarios_disponibles_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electivo_categorias" ADD CONSTRAINT "electivo_categorias_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
