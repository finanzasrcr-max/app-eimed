import { createContext, useContext } from 'react';

export interface ToastApi {
  success(mensaje: string): void;
  error(mensaje: string): void;
  warning(mensaje: string): void;
  info(mensaje: string): void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return ctx;
}
