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

  // ─── Fetch desde Supabase ───────────────────────────────────────────
  const fetchFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      if (isSingleObject || !isArray) {
        const { data: row, error } = await supabase
          .from(tableName)
          .select('data')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (row?.data !== undefined) {
          setDataState(row.data as T);
          saveToLocalStorage(key, row.data);
        }
      } else {
        const { data: rows, error } = await supabase
          .from(tableName)
          .select('id, data')
          .order('created_at', { ascending: true });

        if (error) throw error;
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

  // Suscripción real-time
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel(`db-${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => { fetchFromSupabase(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tableName, fetchFromSupabase]);

  // ─── Setter ──────────────────────────────────────────────────────────
  const setValue = useCallback(
    async (value: T | ((val: T) => T)) => {
      const newValue = value instanceof Function ? value(dataRef.current) : value;

      // Actualización optimista inmediata
      setDataState(newValue);
      saveToLocalStorage(key, newValue);

      if (!isSupabaseConfigured) return;

      try {
        if (isSingleObject || !isArray) {
          await supabase
            .from(tableName)
            .upsert({ id: 1, data: newValue });
        } else {
          const newItems = (newValue as unknown[]) || [];
          const newIds = new Set(newItems.map((i: unknown) => (i as { id: string }).id));

          // Eliminar items borrados
          const deletedIds = [...syncedIdsRef.current].filter(id => !newIds.has(id));
          if (deletedIds.length > 0) {
            await supabase.from(tableName).delete().in('id', deletedIds);
          }

          // Upsert todos los items actuales
          if (newItems.length > 0) {
            const rows = newItems.map((item: unknown) => ({
              id: (item as { id: string }).id,
              data: item,
            }));
            await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
          }

          syncedIdsRef.current = newIds;
        }
      } catch (err) {
        console.error(`[useDB] Error saving "${tableName}":`, err);
      }
    },
    [key, tableName, isArray, isSingleObject]
  );

  return [data, setValue] as const;
}
