/**
 * appSettings — configuración general de la aplicación (clave única 'app_settings').
 *
 * Se guarda como un solo objeto vía useLocalStorage (sincroniza con la tabla
 * 'app_settings' en Supabase; si la tabla no existe aún, funciona igual en
 * localStorage con un error en consola).
 */

import { useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export interface DocTemplates {
  /** Notas al pie de la factura (reemplaza el texto por defecto del footer) */
  invoice_footer: string;
  /** Términos / condiciones o instrucciones de pago de la factura */
  invoice_terms: string;
  /** Nota al pie del recibo (comprobante de planilla y recibo de ingreso) */
  receipt_note: string;
  /** Párrafo introductorio del contrato de alquiler */
  contract_intro: string;
  /** Cláusulas adicionales del contrato (texto libre) */
  contract_clauses: string;
}

export interface CatalogCategories {
  services: string[];
  equipment: string[];
  supplies: string[];
}

export interface AppSettings {
  payment_methods: string[];
  catalog_categories: CatalogCategories;
  doc_templates: DocTemplates;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  payment_methods: ['Transferencia', 'Efectivo', 'Cheque'],
  catalog_categories: {
    services: ['Enfermería', 'Procedimientos', 'General'],
    equipment: ['Mobiliario', 'Respiratorio', 'Movilidad', 'General'],
    supplies: ['Higiene', 'Protección', 'Medicamentos', 'General'],
  },
  doc_templates: {
    invoice_footer: '',
    invoice_terms: '',
    receipt_note: '',
    contract_intro: '',
    contract_clauses: '',
  },
};

/** Rellena slices faltantes (datos guardados con versiones anteriores). */
export function normalizeAppSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    payment_methods:
      raw?.payment_methods && raw.payment_methods.length > 0
        ? raw.payment_methods
        : [...DEFAULT_APP_SETTINGS.payment_methods],
    catalog_categories: {
      services: raw?.catalog_categories?.services ?? [...DEFAULT_APP_SETTINGS.catalog_categories.services],
      equipment: raw?.catalog_categories?.equipment ?? [...DEFAULT_APP_SETTINGS.catalog_categories.equipment],
      supplies: raw?.catalog_categories?.supplies ?? [...DEFAULT_APP_SETTINGS.catalog_categories.supplies],
    },
    doc_templates: {
      ...DEFAULT_APP_SETTINGS.doc_templates,
      ...(raw?.doc_templates || {}),
    },
  };
}

export function useAppSettings() {
  const [raw, setRaw] = useLocalStorage<AppSettings>('app_settings', DEFAULT_APP_SETTINGS);

  const settings = normalizeAppSettings(raw);

  const setPaymentMethods = useCallback(
    (methods: string[]) =>
      setRaw(prev => ({ ...normalizeAppSettings(prev), payment_methods: methods })),
    [setRaw]
  );

  const setCatalogCategories = useCallback(
    (patch: Partial<CatalogCategories>) =>
      setRaw(prev => {
        const base = normalizeAppSettings(prev);
        return { ...base, catalog_categories: { ...base.catalog_categories, ...patch } };
      }),
    [setRaw]
  );

  const setDocTemplates = useCallback(
    (patch: Partial<DocTemplates>) =>
      setRaw(prev => {
        const base = normalizeAppSettings(prev);
        return { ...base, doc_templates: { ...base.doc_templates, ...patch } };
      }),
    [setRaw]
  );

  return { settings, setPaymentMethods, setCatalogCategories, setDocTemplates };
}
