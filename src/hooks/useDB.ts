/**
 * useDB — reemplazo directo de useLocalStorage con sincronización a Supabase.
 *
 * Estrategia:
 *  1. Carga inicial desde localStorage (sin flash/parpadeo).
 *  2. En background, fetch desde Supabase y actualiza el estado.
 *  3. Suscripción real-time: cuando otro usuario cambia datos, se actualiza.
 *  4. Al guardar: escribe a Supabase + localStorage (cache offline).
 *  5. Si Supabase no está configurado, funciona 100% en localStorage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Mapeo de claves localStorage → nombres de tablas en Supabase
const TABLE_MAP: Record<string, string> = {
  payrollRuns: 'payroll_runs',
  payrollAdjustments: 'payroll_adjustments',
  supply_sales: 'sales',
  sales: 'sales',
  shiftTypeDefs: 'shift_type_defs',
  payroll_adjustment_types: 'payroll_adjustment_types',
  document_correlatives: 'document_correlatives',
  company_info: 'company_info',
  system_correlatives: 'system_correlatives',
  catalog_services: 'catalog_services',
  catalog_equipment: 'catalog_equipment',
  catalog_supplies: 'catalog_supplies',
  nurses: 'nurses',
  patients: 'patients',
  clients: 'clients',
  shifts: 'shifts',
  invoices: 'invoices',
  contracts: 'contracts',
  rentals: 'rentals',
  receipts: 'income_receipts',
  documents: 'app_documents',
  ar_payments: 'ar_payments',
  ap_payments: 'ap_payments',
  quotations: 'quotations',
};

// Claves que guardan un único objeto (no array)
const SINGLE_OBJECT_KEYS = new Set(['company_info', 'system_correlatives']);

function getTableName(key: string): string {
  return TABLE_MAP[key] || key;
}

function readFromLocalStorage<T>(key: string, initialValue: T): T {
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently fail
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const tableName = getTableName(key);
  const isArray = Array.isArray(initialValue);
  const isSingleObject = SINGLE_OBJECT_KEYS.has(key);

  // Estado inicial desde localStorage (instantáneo, sin flash)
  const [data, setDataState] = useState<T>(() => readFromLocalStorage(key, initialValue));

  // Ref para tracking de IDs sincronizados (para detectar deletes)
  const syncedIdsRef = useRef<Set<string>>(new Set());
  // Ref del valor actual para uso en callbacks sin stale closure
  const dataRef = useRef<T>(data);
  dataRef.current = data;
  // Escrituras propias en vuelo: mientras haya alguna, no aplicar refetches
  // (evita que un fetch con datos viejos revierta la edición en pantalla)
  const pendingWritesRef = useRef(0);
  // Generación de escrituras: un fetch que empezó antes de una escritura
  // trae datos viejos aunque termine después; se detecta comparando esto
  const writeGenRef = useRef(0);
  // Un fetch descartado por escrituras en vuelo se repite al drenar la cola
  const refetchQueuedRef = useRef(false);
  // IDs cuyo upsert falló (p. ej. sin conexión): se reintentan en el próximo guardado
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  // Omitir el refetch del primer SUBSCRIBED (el fetch inicial ya corre aparte)
  const firstSubscribeRef = useRef(true);

  // ─── Fetch desde Supabase ───────────────────────────────────────────
  const fetchFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const genAtStart = writeGenRef.current;
    // Si hubo o hay una escritura propia desde que empezó este fetch, su
    // resultado ya está viejo: descartarlo y volver a pedir datos frescos
    // (al drenar las escrituras, o de inmediato si ya drenaron).
    const isStale = () => {
      if (writeGenRef.current === genAtStart && pendingWritesRef.current === 0) return false;
      if (pendingWritesRef.current > 0) {
        refetchQueuedRef.current = true;
      } else {
        fetchFromSupabase();
      }
      return true;
    };

    try {
      if (isSingleObject || !isArray) {
        const { data: row, error } = await supabase
          .from(tableName)
          .select('data')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (row?.data !== undefined && !isStale()) {
          setDataState(row.data as T);
          saveToLocalStorage(key, row.data);
        }
      } else {
        const { data: rows, error } = await supabase
          .from(tableName)
          .select('id, data')
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Con la sesión caducada, RLS devuelve [] sin error (SELECT como anon).
        // No pisar una caché local con datos usando ese resultado vacío.
        if (
          (rows || []).length === 0 &&
          Array.isArray(dataRef.current) &&
          (dataRef.current as unknown[]).length > 0
        ) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
        }

        if (isStale()) return;

        const items = (rows || []).map((r: { id: string; data: unknown }) => r.data) as T;
        syncedIdsRef.current = new Set((rows || []).map((r: { id: string }) => r.id));
        setDataState(items);
        saveToLocalStorage(key, items);
      }
    } catch (err) {
      console.error(`[useDB] Error fetching "${tableName}":`, err);
    }
  }, [tableName, key, isArray, isSingleObject]);

  // Fetch inicial
  useEffect(() => {
    fetchFromSupabase();
  }, [fetchFromSupabase]);

  // Suscripción real-time: aplica cada cambio de forma incremental usando el
  // payload del evento. Así el eco de una escritura propia es un no-op (el
  // contenido ya coincide) y un cambio ajeno solo toca la fila afectada, sin
  // refetch completo que pueda revertir lo que hay en pantalla.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // dataRef se actualiza aquí mismo (no solo en el render) para que dos
    // eventos que lleguen en el mismo tick no se pisen entre sí.
    const applyRow = (rowId: string, rowData: unknown) => {
      if (isSingleObject || !isArray) {
        if (JSON.stringify(dataRef.current) === JSON.stringify(rowData)) return;
        dataRef.current = rowData as T;
        setDataState(rowData as T);
        saveToLocalStorage(key, rowData);
        return;
      }
      syncedIdsRef.current.add(rowId);
      const arr = dataRef.current as unknown[];
      const idx = arr.findIndex(i => (i as { id: string }).id === rowId);
      // Eco de nuestra propia escritura (contenido idéntico): no tocar el estado
      if (idx >= 0 && JSON.stringify(arr[idx]) === JSON.stringify(rowData)) return;
      const next = idx >= 0
        ? [...arr.slice(0, idx), rowData, ...arr.slice(idx + 1)]
        : [...arr, rowData];
      dataRef.current = next as T;
      setDataState(next as T);
      saveToLocalStorage(key, next);
    };

    const removeRow = (rowId: string) => {
      syncedIdsRef.current.delete(rowId);
      if (isSingleObject || !isArray) return;
      const arr = dataRef.current as unknown[];
      const next = arr.filter(i => (i as { id: string }).id !== rowId);
      if (next.length === arr.length) return;
      dataRef.current = next as T;
      setDataState(next as T);
      saveToLocalStorage(key, next);
    };

    const channel = supabase
      .channel(`db-${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string | number })?.id;
            if (oldId === undefined) { fetchFromSupabase(); return; }
            removeRow(String(oldId));
            return;
          }
          const row = payload.new as { id?: string | number; data?: unknown };
          if (row?.id === undefined || row.data === undefined) {
            // Payload incompleto (p. ej. fila muy grande): fallback a refetch
            fetchFromSupabase();
            return;
          }
          applyRow(String(row.id), row.data);
        }
      )
      .subscribe((status) => {
        // Al reconectarse el canal (red caída, equipo suspendido) se pudieron
        // perder eventos: reconciliar con un fetch completo. El primer
        // SUBSCRIBED del montaje se omite porque ya hay un fetch inicial.
        if (status === 'SUBSCRIBED') {
          if (firstSubscribeRef.current) {
            firstSubscribeRef.current = false;
            return;
          }
          fetchFromSupabase();
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [tableName, key, isArray, isSingleObject, fetchFromSupabase]);

  // ─── Setter ──────────────────────────────────────────────────────────
  const setValue = useCallback(
    async (value: T | ((val: T) => T)) => {
      const prevValue = dataRef.current;
      const newValue = value instanceof Function ? value(prevValue) : value;

      // Actualización optimista inmediata. dataRef también, para que un
      // segundo setValue en el mismo tick no parta de un estado viejo.
      dataRef.current = newValue;
      setDataState(newValue);
      saveToLocalStorage(key, newValue);

      if (!isSupabaseConfigured) return;

      writeGenRef.current++;
      pendingWritesRef.current++;
      try {
        if (isSingleObject || !isArray) {
          const { error } = await supabase
            .from(tableName)
            .upsert({ id: 1, data: newValue });
          if (error) throw error;
        } else {
          const newItems = (newValue as unknown[]) || [];
          const newIds = new Set(newItems.map((i: unknown) => (i as { id: string }).id));
          const deletedIds = [...syncedIdsRef.current].filter(id => !newIds.has(id));

          // Upsert SOLO las filas que cambiaron respecto al estado anterior
          // (antes se reescribía la tabla completa: dos usuarios editando
          // registros distintos se pisaban mutuamente). Se incluyen también
          // las filas cuyo guardado anterior falló, para reintentarlas.
          // Corto-circuito por referencia: las filas no tocadas conservan el
          // mismo objeto, así que solo se serializan las que cambiaron.
          const prevById = new Map(
            (Array.isArray(prevValue) ? (prevValue as unknown[]) : []).map(
              (i: unknown) => [(i as { id: string }).id, i]
            )
          );
          const changedItems = newItems.filter((item: unknown) => {
            const id = (item as { id: string }).id;
            if (dirtyIdsRef.current.has(id)) return true;
            const prev = prevById.get(id);
            if (prev === item) return false;
            return JSON.stringify(prev) !== JSON.stringify(item);
          });

          // IDs sucios que ya no existen: no hay nada que reintentar
          dirtyIdsRef.current.forEach(id => {
            if (!newIds.has(id)) dirtyIdsRef.current.delete(id);
          });

          try {
            const ops: PromiseLike<void>[] = [];
            if (deletedIds.length > 0) {
              ops.push(
                supabase.from(tableName).delete().in('id', deletedIds)
                  .then(({ error }) => { if (error) throw error; })
              );
            }
            if (changedItems.length > 0) {
              const rows = changedItems.map((item: unknown) => ({
                id: (item as { id: string }).id,
                data: item,
              }));
              ops.push(
                supabase.from(tableName).upsert(rows, { onConflict: 'id' })
                  .then(({ error }) => { if (error) throw error; })
              );
            }
            await Promise.all(ops);
            changedItems.forEach((item: unknown) => dirtyIdsRef.current.delete((item as { id: string }).id));
            syncedIdsRef.current = newIds;
          } catch (err) {
            // Marcar lo que pudo quedar sin escribir para reintentar en el
            // próximo guardado de esta tabla
            changedItems.forEach((item: unknown) => dirtyIdsRef.current.add((item as { id: string }).id));
            throw err;
          }
        }
      } catch (err) {
        console.error(`[useDB] Error saving "${tableName}":`, err);
      } finally {
        pendingWritesRef.current--;
        // Si un fetch se descartó mientras esta escritura estaba en vuelo,
        // reconciliar ahora con datos frescos
        if (pendingWritesRef.current === 0 && refetchQueuedRef.current) {
          refetchQueuedRef.current = false;
          fetchFromSupabase();
        }
      }
    },
    [key, tableName, isArray, isSingleObject, fetchFromSupabase]
  );

  return [data, setValue] as const;
}
