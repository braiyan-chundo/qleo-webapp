import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { Table } from '@/components/ui/table';

/**
 * Subcomponentes reutilizables para las tablas del producto (usuarios, auditoría, lista de
 * tareas, festivos). Unifican el look: tarjeta redondeada, cabeceras en mayúsculas tenues,
 * filas con aire + hover, celda de avatar+nombre, estado con punto de color y pie de
 * paginación "Mostrando X–Y de Z". Todo con tokens M3 (sin hex).
 */

/**
 * Estilos compartidos aplicados a la `<Table>` vía selectores de descendencia, para no tener
 * que reestilar cada `<TableHead>`/`<TableCell>` en cada página. Sube la especificidad lo
 * suficiente para ganarle al primitivo (hover/borde de fila).
 */
const TABLE_STYLES = cn(
  '[&_thead_tr]:border-outline-variant/40 [&_thead_tr]:bg-surface-container-low [&_thead_tr:hover]:bg-surface-container-low',
  '[&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-on-surface-variant [&_th]:uppercase',
  '[&_tbody_tr]:border-outline-variant/30 [&_tbody_tr:hover]:bg-surface-container-low/60',
  '[&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle',
);

/**
 * Tarjeta contenedora + `<Table>` con el estilo unificado. Los hijos son `TableHeader`/`TableBody`.
 *
 * Responsive: si se pasa `cards`, la **tabla se oculta en móvil** (`hidden md:block`) y en su lugar
 * se muestra el listado de tarjetas (`md:hidden`) —más cómodo de leer en pantallas pequeñas—. Si no
 * se pasa `cards`, la tabla se mantiene en todos los tamaños (con scroll horizontal del primitivo).
 */
export function DataTableCard({
  children,
  cards,
  className,
}: {
  children: ReactNode;
  cards?: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-outline-variant/40 bg-surface',
          cards && 'hidden md:block',
          className,
        )}
      >
        <Table className={TABLE_STYLES}>{children}</Table>
      </div>
      {cards && <div className="space-y-2.5 md:hidden">{cards}</div>}
    </>
  );
}

/**
 * Tarjeta de una fila para la **vista móvil** de las tablas (reemplaza `<TableRow>` en pantallas
 * pequeñas). Si recibe `onClick`, se renderiza como botón (fila clicable, p. ej. abrir detalle).
 */
export function DataCard({
  children,
  onClick,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  const base =
    'flex w-full flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface p-4 text-left';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          base,
          'transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className,
        )}
      >
        {children}
      </button>
    );
  }
  return <div className={cn(base, className)}>{children}</div>;
}

/** Fila «etiqueta → valor» dentro de una `DataCard`. */
export function DataCardRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="min-w-0 text-right font-medium text-on-surface">
        {children}
      </span>
    </div>
  );
}

/** Celda de entidad: avatar (imagen o iniciales) + nombre en negrita + subtítulo tenue. */
export function AvatarCell({
  name,
  subtitle,
  avatarUrl,
  avatarDownloadUrl,
}: {
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  /** QL-32: proxy privado del avatar subido (prioridad sobre `avatarUrl`). */
  avatarDownloadUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <AuthedAvatar
        name={name}
        avatarUrl={avatarUrl}
        avatarDownloadUrl={avatarDownloadUrl}
        fallbackClassName="bg-primary-container text-on-primary-container text-xs font-semibold"
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-on-surface">{name}</span>
        {subtitle && (
          <span className="truncate text-xs text-on-surface-variant">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

type StatusTone = 'success' | 'muted' | 'error' | 'warning';

const DOT_TONE: Record<StatusTone, string> = {
  success: 'bg-palette-green-dot',
  muted: 'bg-outline',
  error: 'bg-error',
  warning: 'bg-palette-orange-dot',
};

/** Estado como punto de color + etiqueta (p. ej. Activo/Inactivo). */
export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 shrink-0 rounded-full', DOT_TONE[tone])} aria-hidden />
      <span
        className={cn(
          'text-sm font-medium',
          tone === 'muted' ? 'text-on-surface-variant' : 'text-on-surface',
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Badge del rol de plataforma: Administrador (verde tonal) · Miembro (azul tonal). */
export function RoleBadge({ role }: { role: 'ADMIN' | 'MEMBER' }) {
  return (
    <Badge
      className={
        role === 'ADMIN'
          ? 'bg-palette-green-surface text-palette-green-on-surface'
          : 'bg-palette-blue-surface text-palette-blue-on-surface'
      }
    >
      {role === 'ADMIN' ? 'Administrador' : 'Miembro'}
    </Badge>
  );
}

/** Pie de paginación: "Mostrando X–Y de Z {itemLabel}" + controles anterior/siguiente. */
export function TablePagination({
  page,
  pageSize,
  total,
  itemLabel,
  onPrev,
  onNext,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-on-surface-variant">
        Mostrando <span className="font-medium text-on-surface">{from}</span>–
        <span className="font-medium text-on-surface">{to}</span> de{' '}
        <span className="font-medium text-on-surface">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1 || disabled}
          onClick={onPrev}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm text-on-surface-variant tabular-nums">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages || disabled}
          onClick={onNext}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
