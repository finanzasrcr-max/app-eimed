-- ============================================================
-- EIMED App — Abrir ESCRITURA a todos los usuarios autenticados
-- ------------------------------------------------------------
-- PROBLEMA QUE RESUELVE:
--   Las políticas originales solo permitían ESCRIBIR a usuarios
--   con role = 'admin' (función public.is_admin()). Si el perfil
--   de un usuario no quedó marcado como 'admin' (o el perfil no
--   existe), sus cambios se RECHAZAN en silencio y solo quedan en
--   el localStorage de su navegador → cada dispositivo ve algo
--   distinto.
--
--   Este script reemplaza esa regla por "cualquier usuario
--   autenticado puede escribir", igual que ya estaba la tabla
--   de turnos (shifts). La LECTURA ya era para todos; no cambia.
--
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Es idempotente: se puede correr varias veces sin daño.
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY array[
    'clients','patients','nurses','invoices','income_receipts',
    'payments','ar_payments','ap_payments','rentals','sales',
    'payroll_runs','payroll_adjustments','contracts',
    'catalog_services','catalog_equipment','catalog_supplies',
    'document_correlatives','shift_type_defs','payroll_adjustment_types',
    'app_documents','company_info','system_correlatives','quotations'
  ] LOOP
    -- Solo si la tabla existe (idempotencia defensiva)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Quitar la política vieja de "solo admins escriben"
      EXECUTE format('DROP POLICY IF EXISTS "Admins escriben %I" ON public.%I;', t, t);
      -- Quitar la nueva (por si se corre el script más de una vez)
      EXECUTE format('DROP POLICY IF EXISTS "Autenticados escriben %I" ON public.%I;', t, t);

      -- Crear la nueva: cualquier usuario autenticado puede escribir
      EXECUTE format(
        'CREATE POLICY "Autenticados escriben %I" ON public.%I
           FOR ALL TO authenticated
           USING (auth.uid() IS NOT NULL)
           WITH CHECK (auth.uid() IS NOT NULL);', t, t
      );

      -- Asegurar que la política de LECTURA exista (por si faltara)
      EXECUTE format('DROP POLICY IF EXISTS "Todos leen %I" ON public.%I;', t, t);
      EXECUTE format(
        'CREATE POLICY "Todos leen %I" ON public.%I
           FOR SELECT TO authenticated USING (true);', t, t
      );
    END IF;
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────
-- VERIFICACIÓN: después de correr el script, esta query debe
-- mostrar una política "Autenticados escriben ..." por tabla.
-- ──────────────────────────────────────────────────────────────
SELECT tablename AS "Tabla", policyname AS "Política", cmd AS "Operación"
FROM pg_policies
WHERE schemaname = 'public' AND cmd = 'ALL'
ORDER BY tablename;
