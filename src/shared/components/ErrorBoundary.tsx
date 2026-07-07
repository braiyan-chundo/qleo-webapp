import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorScreen } from '@/shared/components/ErrorScreen';

/**
 * Fallback de render del `ErrorBoundary` (QL-50). Componente funcional para poder usar
 * `useNavigate` (los componentes de clase no admiten hooks). "Volver" resetea el boundary
 * y navega atrás; "Ir a inicio" resetea y va a la raíz. Debe renderizarse dentro del
 * Router.
 */
function ErrorFallback({ onReset }: { onReset: () => void }) {
  const navigate = useNavigate();

  return (
    <ErrorScreen
      title="Algo salió mal"
      description="Ocurrió un error inesperado al mostrar esta página. Puedes volver o ir al inicio."
    >
      <Button
        variant="outline"
        onClick={() => {
          onReset();
          navigate(-1);
        }}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Button>
      <Button
        onClick={() => {
          onReset();
          navigate('/');
        }}
      >
        <Home className="size-4" aria-hidden />
        Ir a inicio
      </Button>
    </ErrorScreen>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * ErrorBoundary de aplicación (QL-50). Captura errores de render de sus hijos y muestra
 * una pantalla de marca en lugar de una pantalla en blanco. Reutilizable para futuros
 * `Suspense`/lazy. Debe montarse **dentro** del Router para que el fallback pueda navegar.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary capturó un error de render:', error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
