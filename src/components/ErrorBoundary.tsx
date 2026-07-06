import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Fallback compacto para usarse dentro del layout (no pantalla completa) */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Captura errores de render para que un registro malformado no deje
// la app en pantalla blanca; ofrece recargar sin perder la sesión.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary capturó un error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: this.props.compact ? '50vh' : '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'inherit',
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Algo salió mal</h1>
          <p style={{ maxWidth: 420, color: 'var(--text-muted, #64748b)' }}>
            Ocurrió un error inesperado al mostrar esta pantalla. Tus datos guardados
            no se perdieron. Recarga la aplicación para continuar.
          </p>
          {this.state.error && (
            <code style={{
              fontSize: 12,
              color: 'var(--text-muted, #94a3b8)',
              maxWidth: 480,
              overflowWrap: 'break-word',
            }}>
              {this.state.error.message}
            </code>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Recargar aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
