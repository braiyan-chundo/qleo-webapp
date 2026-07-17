import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FolderOpen, Loader2, ListFilter, Mail, MailOpen, MoreVertical, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { Notification } from '../services/notifications.service';
import { notificationText, timeAgo } from '../lib/notification-text';
import { resolveNotificationHref } from '../lib/notification-nav';
import { NotificationAvatar } from './NotificationAvatar';

interface NotificationRowProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onDelete: (id: string) => void;
  /** Activa el filtro "solo esta tarea" (QL-137). Ausente si ya se está filtrando por ella. */
  onFilterByTask?: (taskId: string) => void;
  deleting?: boolean;
}

/**
 * Fila de la bandeja (QL-13, enriquecida en QL-137). Al hacer clic en el cuerpo: marca leída
 * (optimista) y navega según el tipo (`notification-nav`). Las acciones —marcar como no leída /
 * leída, filtrar por su tarea y eliminar— viven en un menú **⋮** siempre visible y enfocable
 * (mismo patrón que las burbujas del muro, QL-108: un affordance solo-hover no existe al tacto).
 *
 * El cuerpo es un `<button>` y el ⋮ es su **hermano**, no un anidado: un `<button>` dentro de
 * otro es HTML inválido.
 */
export function NotificationRow({
  notification,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onFilterByTask,
  deleting = false,
}: NotificationRowProps) {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const projectName = notification.project?.name?.trim();
  // A una const sí la estrecha TS dentro del closure del `onSelect` (a `notification.taskId`
  // lo volvería a ensanchar a `string | null` y haría falta un cast).
  const taskId = notification.taskId;

  const handleOpen = async () => {
    if (resolving) return;
    if (!notification.read) onMarkRead(notification.id);
    setResolving(true);
    try {
      const href = await resolveNotificationHref(notification);
      if (href) navigate(href);
    } catch {
      toast.error('No se pudo abrir la notificación (puede haber sido eliminada)');
    } finally {
      setResolving(false);
    }
  };

  return (
    <li
      className={cn(
        'flex items-start gap-1 rounded-lg border transition-colors',
        notification.read
          ? 'border-outline-variant/30 bg-surface-container-lowest'
          : 'border-primary/20 bg-surface-container-low',
        deleting && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-container/60"
      >
        <NotificationAvatar actor={notification.actor} className="mt-0.5 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-sm text-on-surface">{notificationText(notification)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-on-surface-variant">
            <span>{timeAgo(notification.createdAt)}</span>
            {/* El proyecto es el "dónde"; el "qué" (la tarea) ya va en el texto. Un proyecto
                borrado llega con `name: ''` (§3.36) → no se pinta el chip. */}
            {projectName && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <FolderOpen className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{projectName}</span>
                </span>
              </>
            )}
          </p>
        </div>

        {resolving ? (
          <Loader2 className="mt-1 size-3.5 shrink-0 animate-spin text-on-surface-variant" />
        ) : (
          !notification.read && (
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
              aria-label="Sin leer"
            />
          )
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="my-2 mr-1 size-7 shrink-0 text-on-surface-variant"
            aria-label="Opciones de la notificación"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {notification.read ? (
            <DropdownMenuItem onSelect={() => onMarkUnread(notification.id)}>
              <Mail />
              Marcar como no leída
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onMarkRead(notification.id)}>
              <MailOpen />
              Marcar como leída
            </DropdownMenuItem>
          )}
          {onFilterByTask && taskId && (
            <DropdownMenuItem onSelect={() => onFilterByTask(taskId)}>
              <ListFilter />
              Solo esta tarea
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar notificación</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará de tu bandeja definitivamente. No afecta a la tarea ni al proyecto:
              solo desaparece el aviso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(notification.id);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
