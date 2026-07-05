import { useRef } from 'react';
import type React from 'react';

// Cierra un overlay solo si la pulsación EMPEZÓ y TERMINÓ sobre el overlay.
// Evita que un drag iniciado dentro del contenido (p. ej. seleccionar texto
// en un input del formulario) cierre el modal y se pierda lo escrito.
export function useOverlayClose(onClose: () => void) {
  const pressStartedOnOverlay = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      pressStartedOnOverlay.current = e.target === e.currentTarget;
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) pressStartedOnOverlay.current = false;
    },
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      if (pressStartedOnOverlay.current && e.target === e.currentTarget) onClose();
      pressStartedOnOverlay.current = false;
    },
  };
}
