-- ============================================================
-- EIMED App — Script de CORRECCIÓN para BD existente
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Es idempotente: se puede correr múltiples veces sin daño.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. AGREGAR created_at A TABLAS DE CATÁLOGO (si falta)
--    Las tablas de catálogo se crearon sin esta columna en la
--    versión original del schema, pero useDB.ts la requiere
--    para ordenar resultados.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.catalog_services  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.catalog_equipment ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.catalog_supplies  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- También agregar a otras tablas que podrían faltar:
ALTER TABLE public.document_correlatives     ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.shift_type_defs           ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.payroll_adjustment_types  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ──────────────────────────────────────────────────────────────
-- 2. RECREAR POLÍTICAS RLS (DROP + CREATE para evitar conflictos)
--    El bloque DO$$ original falla si las políticas ya existen.
--    Este script las elimina y recrea de forma segura.
-- ──────────────────────────────────────────────────────────────

-- Función is_admin (recrear por si no existe)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ── Turnos ──
DROP POLICY IF EXISTS "Todos leen turnos"   ON public.shifts;
DROP POLICY IF EXISTS "Todos escriben turnos" ON public.shifts;
CREATE POLICY "Todos leen turnos"   ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Todos escriben turnos" ON public.shifts FOR ALL    TO authenticated USING (auth.uid() IS NOT NULL);

-- ── Clientes ──
DROP POLICY IF EXISTS "Todos leen clients"   ON public.clients;
DROP POLICY IF EXISTS "Admins escriben clients" ON public.clients;
CREATE POLICY "Todos leen clients"      ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben clients" ON public.clients FOR ALL    TO authenticated USING (public.is_admin());

-- ── Pacientes ──
DROP POLICY IF EXISTS "Todos leen patients"   ON public.patients;
DROP POLICY IF EXISTS "Admins escriben patients" ON public.patients;
CREATE POLICY "Todos leen patients"      ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben patients" ON public.patients FOR ALL    TO authenticated USING (public.is_admin());

-- ── Enfermeras ──
DROP POLICY IF EXISTS "Todos leen nurses"   ON public.nurses;
DROP POLICY IF EXISTS "Admins escriben nurses" ON public.nurses;
CREATE POLICY "Todos leen nurses"      ON public.nurses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben nurses" ON public.nurses FOR ALL    TO authenticated USING (public.is_admin());

-- ── Facturas ──
DROP POLICY IF EXISTS "Todos leen invoices"   ON public.invoices;
DROP POLICY IF EXISTS "Admins escriben invoices" ON public.invoices;
CREATE POLICY "Todos leen invoices"      ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben invoices" ON public.invoices FOR ALL    TO authenticated USING (public.is_admin());

-- ── Recibos de Ingresos ──
DROP POLICY IF EXISTS "Todos leen income_receipts"   ON public.income_receipts;
DROP POLICY IF EXISTS "Admins escriben income_receipts" ON public.income_receipts;
CREATE POLICY "Todos leen income_receipts"      ON public.income_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben income_receipts" ON public.income_receipts FOR ALL    TO authenticated USING (public.is_admin());

-- ── Pagos ──
DROP POLICY IF EXISTS "Todos leen payments"   ON public.payments;
DROP POLICY IF EXISTS "Admins escriben payments" ON public.payments;
CREATE POLICY "Todos leen payments"      ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben payments" ON public.payments FOR ALL    TO authenticated USING (public.is_admin());

-- ── Alquileres ──
DROP POLICY IF EXISTS "Todos leen rentals"   ON public.rentals;
DROP POLICY IF EXISTS "Admins escriben rentals" ON public.rentals;
CREATE POLICY "Todos leen rentals"      ON public.rentals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben rentals" ON public.rentals FOR ALL    TO authenticated USING (public.is_admin());

-- ── Ventas ──
DROP POLICY IF EXISTS "Todos leen sales"   ON public.sales;
DROP POLICY IF EXISTS "Admins escriben sales" ON public.sales;
CREATE POLICY "Todos leen sales"      ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben sales" ON public.sales FOR ALL    TO authenticated USING (public.is_admin());

-- ── Planillas ──
DROP POLICY IF EXISTS "Todos leen payroll_runs"   ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins escriben payroll_runs" ON public.payroll_runs;
CREATE POLICY "Todos leen payroll_runs"      ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben payroll_runs" ON public.payroll_runs FOR ALL    TO authenticated USING (public.is_admin());

-- ── Ajustes de planilla ──
DROP POLICY IF EXISTS "Todos leen payroll_adjustments"   ON public.payroll_adjustments;
DROP POLICY IF EXISTS "Admins escriben payroll_adjustments" ON public.payroll_adjustments;
CREATE POLICY "Todos leen payroll_adjustments"      ON public.payroll_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben payroll_adjustments" ON public.payroll_adjustments FOR ALL    TO authenticated USING (public.is_admin());

-- ── Contratos ──
DROP POLICY IF EXISTS "Todos leen contracts"   ON public.contracts;
DROP POLICY IF EXISTS "Admins escriben contracts" ON public.contracts;
CREATE POLICY "Todos leen contracts"      ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben contracts" ON public.contracts FOR ALL    TO authenticated USING (public.is_admin());

-- ── Catálogo Servicios ──
DROP POLICY IF EXISTS "Todos leen catalog_services"   ON public.catalog_services;
DROP POLICY IF EXISTS "Admins escriben catalog_services" ON public.catalog_services;
CREATE POLICY "Todos leen catalog_services"      ON public.catalog_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben catalog_services" ON public.catalog_services FOR ALL    TO authenticated USING (public.is_admin());

-- ── Catálogo Equipos ──
DROP POLICY IF EXISTS "Todos leen catalog_equipment"   ON public.catalog_equipment;
DROP POLICY IF EXISTS "Admins escriben catalog_equipment" ON public.catalog_equipment;
CREATE POLICY "Todos leen catalog_equipment"      ON public.catalog_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben catalog_equipment" ON public.catalog_equipment FOR ALL    TO authenticated USING (public.is_admin());

-- ── Catálogo Insumos ──
DROP POLICY IF EXISTS "Todos leen catalog_supplies"   ON public.catalog_supplies;
DROP POLICY IF EXISTS "Admins escriben catalog_supplies" ON public.catalog_supplies;
CREATE POLICY "Todos leen catalog_supplies"      ON public.catalog_supplies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben catalog_supplies" ON public.catalog_supplies FOR ALL    TO authenticated USING (public.is_admin());

-- ── Correlativos de documentos ──
DROP POLICY IF EXISTS "Todos leen document_correlatives"   ON public.document_correlatives;
DROP POLICY IF EXISTS "Admins escriben document_correlatives" ON public.document_correlatives;
CREATE POLICY "Todos leen document_correlatives"      ON public.document_correlatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben document_correlatives" ON public.document_correlatives FOR ALL    TO authenticated USING (public.is_admin());

-- ── Tipos de turno ──
DROP POLICY IF EXISTS "Todos leen shift_type_defs"   ON public.shift_type_defs;
DROP POLICY IF EXISTS "Admins escriben shift_type_defs" ON public.shift_type_defs;
CREATE POLICY "Todos leen shift_type_defs"      ON public.shift_type_defs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben shift_type_defs" ON public.shift_type_defs FOR ALL    TO authenticated USING (public.is_admin());

-- ── Tipos de ajuste ──
DROP POLICY IF EXISTS "Todos leen payroll_adjustment_types"   ON public.payroll_adjustment_types;
DROP POLICY IF EXISTS "Admins escriben payroll_adjustment_types" ON public.payroll_adjustment_types;
CREATE POLICY "Todos leen payroll_adjustment_types"      ON public.payroll_adjustment_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben payroll_adjustment_types" ON public.payroll_adjustment_types FOR ALL    TO authenticated USING (public.is_admin());

-- ── Documentos ──
DROP POLICY IF EXISTS "Todos leen app_documents"   ON public.app_documents;
DROP POLICY IF EXISTS "Admins escriben app_documents" ON public.app_documents;
CREATE POLICY "Todos leen app_documents"      ON public.app_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben app_documents" ON public.app_documents FOR ALL    TO authenticated USING (public.is_admin());

-- ── Información de empresa ──
DROP POLICY IF EXISTS "Todos leen company_info"   ON public.company_info;
DROP POLICY IF EXISTS "Admins escriben company_info" ON public.company_info;
CREATE POLICY "Todos leen company_info"      ON public.company_info FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben company_info" ON public.company_info FOR ALL    TO authenticated USING (public.is_admin());

-- ── Correlativos del sistema ──
DROP POLICY IF EXISTS "Todos leen system_correlatives"   ON public.system_correlatives;
DROP POLICY IF EXISTS "Admins escriben system_correlatives" ON public.system_correlatives;
CREATE POLICY "Todos leen system_correlatives"      ON public.system_correlatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escriben system_correlatives" ON public.system_correlatives FOR ALL    TO authenticated USING (public.is_admin());

-- ──────────────────────────────────────────────────────────────
-- FIN DEL SCRIPT
-- Después de ejecutar este script, corre supabase_diagnostics.sql
-- para verificar que todo quedó correcto.
-- ──────────────────────────────────────────────────────────────
