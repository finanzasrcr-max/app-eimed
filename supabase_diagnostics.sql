-- ============================================================
-- EIMED App — Script de DIAGNÓSTICO de base de datos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Corre las 4 queries de forma independiente o juntas.
-- Estado saludable: las queries 1, 2 y 3 devuelven 0 filas.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- QUERY 1: Tablas faltantes
-- Muestra las tablas que el código espera pero no existen en Supabase.
-- Resultado esperado: 0 filas.
-- ──────────────────────────────────────────────────────────────
SELECT expected.table_name AS "Tabla faltante"
FROM (VALUES
  ('clients'),
  ('patients'),
  ('nurses'),
  ('shifts'),
  ('invoices'),
  ('income_receipts'),
  ('payments'),
  ('rentals'),
  ('sales'),
  ('payroll_runs'),
  ('payroll_adjustments'),
  ('contracts'),
  ('catalog_services'),
  ('catalog_equipment'),
  ('catalog_supplies'),
  ('document_correlatives'),
  ('shift_type_defs'),
  ('payroll_adjustment_types'),
  ('app_documents'),
  ('company_info'),
  ('system_correlatives'),
  ('profiles')
) AS expected(table_name)
WHERE expected.table_name NOT IN (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
);


-- ──────────────────────────────────────────────────────────────
-- QUERY 2: Columnas faltantes (created_at)
-- El hook useDB.ts llama .order('created_at') en todas las
-- tablas de arrays. Si falta esa columna → error 42703.
-- Resultado esperado: 0 filas.
-- ──────────────────────────────────────────────────────────────
SELECT t.table_name AS "Tabla", 'created_at' AS "Columna faltante"
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN (
    'clients', 'patients', 'nurses', 'shifts', 'invoices',
    'income_receipts', 'payments', 'rentals', 'sales',
    'payroll_runs', 'payroll_adjustments', 'contracts',
    'catalog_services', 'catalog_equipment', 'catalog_supplies',
    'document_correlatives', 'shift_type_defs', 'payroll_adjustment_types',
    'app_documents'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name  = t.table_name
      AND c.column_name = 'created_at'
  )
ORDER BY t.table_name;


-- ──────────────────────────────────────────────────────────────
-- QUERY 3: Tablas con RLS habilitado pero sin política SELECT
-- Si una tabla tiene RLS pero no hay policy de SELECT para
-- usuarios autenticados → error 42501 permission denied.
-- Resultado esperado: 0 filas.
-- ──────────────────────────────────────────────────────────────
SELECT c.relname AS "Tabla sin política SELECT"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'              -- solo tablas base
  AND c.relrowsecurity = true      -- RLS habilitado
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename  = c.relname
      AND p.cmd IN ('SELECT', 'ALL')
  )
ORDER BY c.relname;


-- ──────────────────────────────────────────────────────────────
-- QUERY 4: Resumen completo de políticas RLS activas
-- Referencia para verificar qué políticas están configuradas
-- en cada tabla y para qué operación.
-- ──────────────────────────────────────────────────────────────
SELECT
  tablename   AS "Tabla",
  policyname  AS "Política",
  cmd         AS "Operación",
  roles::text AS "Roles",
  qual        AS "Condición USING"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ──────────────────────────────────────────────────────────────
-- QUERY 5 (extra): Ver estructura de columnas de todas las tablas
-- Útil para comparar con supabase_schema.sql
-- ──────────────────────────────────────────────────────────────
SELECT
  c.table_name   AS "Tabla",
  c.column_name  AS "Columna",
  c.data_type    AS "Tipo",
  c.column_default AS "Default",
  c.is_nullable  AS "Nullable"
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name NOT IN ('schema_migrations')
ORDER BY c.table_name, c.ordinal_position;
