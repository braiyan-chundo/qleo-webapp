import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorScreen } from '@/shared/components/ErrorScreen';

/**
 * Pantalla 404 (QL-50). Se monta como ruta comodín `*` en `App.tsx` para que una URL
 * desconocida muestre marca + salida en lugar de una pantalla en blanco.
 */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorScreen
      code="404"
      title="Página no encontrada"
      description="La ruta que buscas no existe o fue movida."
    >
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Button>
      <Button onClick={() => navigate('/')}>
        <Home className="size-4" aria-hidden />
        Ir a inicio
      </Button>
    </ErrorScreen>
  );
}
