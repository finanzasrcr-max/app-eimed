-- ============================================================
-- EIMED App — Schema para Supabase
-- Ejecutar este script en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. TABLA DE PERFILES DE USUARIO
-- ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id        uuid references auth.users on delete cascade primary key,
  email     text not null,
  full_name text not null default '',
  role      text not null default 'operativo'
              check (role in ('admin', 'operativo')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: al crear un usuario en auth.users, crear el perfil automáticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'operativo')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 2. TABLAS DE DATOS (una fila por entidad, usando JSONB)
-- ──────────────────────────────────────────────────────────────

-- Clientes
create table if not exists public.clients (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pacientes
create table if not exists public.patients (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enfermeras
create table if not exists public.nurses (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Turnos
create table if not exists public.shifts (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Facturas
create table if not exists public.invoices (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recibos de Ingresos
create table if not exists public.income_receipts (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Pagos (AR)
create table if not exists public.payments (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Alquileres
create table if not exists public.rentals (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ventas de insumos
create table if not exists public.sales (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Planillas de pago
create table if not exists public.payroll_runs (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ajustes de planilla
create table if not exists public.payroll_adjustments (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Contratos
create table if not exists public.contracts (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Catálogo: Servicios
create table if not exists public.catalog_services (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Catálogo: Equipos
create table if not exists public.catalog_equipment (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Catálogo: Insumos
create table if not exists public.catalog_supplies (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- Correlativos de documentos
create table if not exists public.document_correlatives (
  id   text primary key,
  data jsonb not null
);

-- Tipos de turno
create table if not exists public.shift_type_defs (
  id   text primary key,
  data jsonb not null
);

-- Tipos de ajuste (planilla)
create table if not exists public.payroll_adjustment_types (
  id   text primary key,
  data jsonb not null
);

-- Documentos del sistema
create table if not exists public.app_documents (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────
-- 3. TABLAS DE REGISTRO ÚNICO (solo 1 fila)
-- ──────────────────────────────────────────────────────────────

create table if not exists public.company_info (
  id   integer primary key default 1,
  data jsonb not null default '{}',
  constraint company_single_row check (id = 1)
);

create table if not exists public.system_correlatives (
  id   integer primary key default 1,
  data jsonb not null default '{}',
  constraint syscorr_single_row check (id = 1)
);

-- ──────────────────────────────────────────────────────────────
-- 4. TRIGGER: actualizar updated_at automáticamente
-- ──────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Aplicar trigger a tablas con updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'clients','patients','nurses','shifts','invoices',
    'rentals','payroll_runs','contracts'
  ] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute procedure public.set_updated_at();', t, t
    );
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.patients enable row level security;
alter table public.nurses enable row level security;
alter table public.shifts enable row level security;
alter table public.invoices enable row level security;
alter table public.income_receipts enable row level security;
alter table public.payments enable row level security;
alter table public.rentals enable row level security;
alter table public.sales enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.contracts enable row level security;
alter table public.catalog_services enable row level security;
alter table public.catalog_equipment enable row level security;
alter table public.catalog_supplies enable row level security;
alter table public.document_correlatives enable row level security;
alter table public.shift_type_defs enable row level security;
alter table public.payroll_adjustment_types enable row level security;
alter table public.app_documents enable row level security;
alter table public.company_info enable row level security;
alter table public.system_correlatives enable row level security;

-- Función helper: verificar si el usuario actual es admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ── Profiles ──
create policy "Usuarios ven todos los perfiles"
  on public.profiles for select to authenticated using (true);

create policy "Admins gestionan perfiles"
  on public.profiles for all to authenticated
  using (public.is_admin());

create policy "Usuario actualiza su propio perfil"
  on public.profiles for update to authenticated
  using (id = auth.uid());

-- ── Turnos: todos los autenticados pueden leer Y escribir ──
create policy "Todos leen turnos"
  on public.shifts for select to authenticated using (true);

create policy "Todos escriben turnos"
  on public.shifts for all to authenticated
  using (auth.uid() is not null);

-- ── Resto de tablas: todos leen, solo admins escriben ──
do $$
declare t text;
begin
  foreach t in array array[
    'clients','patients','nurses','invoices','income_receipts',
    'payments','rentals','sales','payroll_runs','payroll_adjustments',
    'contracts','catalog_services','catalog_equipment','catalog_supplies',
    'document_correlatives','shift_type_defs','payroll_adjustment_types',
    'app_documents','company_info','system_correlatives'
  ] loop
    execute format(
      'create policy "Todos leen %I" on public.%I
       for select to authenticated using (true);', t, t
    );
    execute format(
      'create policy "Admins escriben %I" on public.%I
       for all to authenticated using (public.is_admin());', t, t
    );
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────
-- FIN DEL SCRIPT
-- Siguiente paso: ver MIGRATION_GUIDE.md para migrar los datos
-- actuales desde localStorage hacia Supabase.
-- ──────────────────────────────────────────────────────────────
