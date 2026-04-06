// Re-exporta desde useDB para que todos los componentes existentes
// funcionen sin cambios mientras se agrega sincronización con Supabase.
export { useLocalStorage } from './useDB';
