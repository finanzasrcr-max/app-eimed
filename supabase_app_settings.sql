-- ============================================================
-- EIMED App — Tabla app_settings (Configuración general)
-- ------------------------------------------------------------
-- Guarda un ÚNICO registro (id = 1) con la configuración de la
-- aplicación: métodos de pago, categorías de catálogo y
-- plantillas de texto para documentos (factura, recibo, contrato).
--
-- Sigue el mismo patrón que company_info / system_correlatives:
--   - tabla de registro único {id, data jsonb}
--   - RLS habilitado
--   - lectura para todos los autenticados
--   - escritura para todos los autenticados (igual que
--     supabase_open_writes.sql)
--   - grants explícitos (cambio Supabase 2026)
--
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Es idempotente: se puede correr varias veces sin daño.
-- ============================================================

create table if not exists public.app_settings (
  id   integer primary key default 1,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  constraint app_settings_single_row check (id = 1)
);

-- ── Row Level Security ──
alter table public.app_settings enable row level security;

drop policy if exists "Todos leen app_settings" on public.app_settings;
create policy "Todos leen app_settings" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "Admins escriben app_settings" on public.app_settings;
drop policy if exists "Autenticados escriben app_settings" on public.app_settings;
create policy "Autenticados escriben app_settings" on public.app_settings
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ── Grants explícitos (preparado para cambio Supabase 30-oct-2026) ──
grant select, insert, update, delete on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

-- ── Registro inicial con los valores por defecto ──
insert into public.app_settings (id, data)
values (
  1,
  '{
    "payment_methods": ["Transferencia", "Efectivo", "Cheque"],
    "catalog_categories": {
      "services":  ["Enfermería", "Procedimientos", "General"],
      "equipment": ["Mobiliario", "Respiratorio", "Movilidad", "General"],
      "supplies":  ["Higiene", "Protección", "Medicamentos", "General"]
    },
    "doc_templates": {
      "invoice_footer": "",
      "invoice_terms": "",
      "receipt_note": "",
      "contract_intro": "",
      "contract_clauses": ""
    }
  }'::jsonb
)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────
-- VERIFICACIÓN: debe devolver 1 fila con las políticas creadas.
-- ──────────────────────────────────────────────────────────────
select tablename as "Tabla", policyname as "Política", cmd as "Operación"
from pg_policies
where schemaname = 'public' and tablename = 'app_settings'
order by policyname;
