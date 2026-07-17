import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { resolveNavLabel } from '@/shared/lib/nav-history';
import {
  selectPreviousNavEntry,
  useNavHistoryStore,
} from '@/store/nav-history.store';

/** Destino de reserva cuando no hay ruta anterior interna (deep-link / pestaña nueva). */
export interface BackButtonFallback {
  /** Ruta a la que ir (padre lógico de la vista). */
  to: string;
  /** Nombre amable del destino para el tooltip ("Volver a: {label}"). */
  label: string;
}

interface BackButtonProps {
  /** Padre lógico de esta vista, usado cuando no existe ruta anterior en el historial interno. */
  fallback: BackButtonFallback;
  className?: string;
}

/**
 * Botón "Volver" genérico (QL-140). Devuelve al usuario a la **ruta anterior del router** y
 * muestra en un tooltip a dónde regresa. Pensado para ir junto al título de cada vista.
 *
 * - Si hay una entrada anterior en el historial interno (`nav-history.store`), navega con
 *   `navigate(-1)` —preserva scroll/estado del navegador— y el tooltip usa la etiqueta de esa
 *   entrada, resuelta contra la caché de Query (nombre real de proyecto/tarea cuando aplica).
 * - Si no la hay (el usuario entró por deep-link), cae al `fallback` (padre lógico): navega a
 *   `fallback.to` y el tooltip usa `fallback.label`.
 */
export function BackButton({ fallback, className }: BackButtonProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previous = useNavHistoryStore(selectPreviousNavEntry);

  const label = previous
    ? resolveNavLabel(previous.path, queryClient)
    : fallback.label;
  const tooltip = `Volver a: ${label}`;

  const handleClick = () => {
    if (previous) navigate(-1);
    else navigate(fallback.to);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleClick}
          aria-label={tooltip}
          className={cn(
            'shrink-0 text-on-surface-variant hover:text-on-surface',
            className,
          )}
        >
          <ArrowLeft className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
