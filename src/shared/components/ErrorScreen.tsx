import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { QleoMark } from '@/shared/components/QleoLogo';

interface ErrorScreenProps {
  /** Código grande opcional (p. ej. "404"). */
  code?: string;
  title: string;
  description: string;
  /** Acciones (botones) que se muestran bajo el mensaje. */
  children?: ReactNode;
  className?: string;
}

/**
 * Pantalla de error de marca (QL-50), reutilizada por el `ErrorBoundary` y la
 * `NotFoundPage`. Centrada, con la marca `QleoMark`, mensaje y ranura para acciones.
 */
export function ErrorScreen({
  code,
  title,
  description,
  children,
  className,
}: ErrorScreenProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center',
        className,
      )}
    >
      <QleoMark className="size-16 text-primary dark:text-inverse-primary dark:glow-text" />

      {code && (
        <p className="font-heading text-6xl font-bold leading-none text-on-surface">
          {code}
        </p>
      )}

      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold text-on-surface">{title}</h1>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>

      {children && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
