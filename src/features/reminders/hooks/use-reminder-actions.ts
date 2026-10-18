import { toast } from 'sonner';

import type { ReminderResponseDto } from '../types/reminder.types';
import { isNetworkError, reminderErrorCode, REMINDER_ERROR_TEXT } from '../lib/reminder-errors';
import { useDeleteReminder, useToggleReminder, type ReminderToggleAction } from './use-reminders';

/**
 * Pausar/reanudar y borrar **un** recordatorio, con sus avisos de error. Una instancia por fila:
 * así el interruptor de cada fila pinta su propio estado pendiente y vuelve atrás si falla
 * (maqueta: «sin conexión»).
 */
export function useReminderActions(reminder: Pick<ReminderResponseDto, 'id' | 'status'>) {
  const toggle = useToggleReminder();
  const remove = useDeleteReminder();

  const reportChangeError = (error: unknown) => {
    if (isNetworkError(error)) {
      toast.error(REMINDER_ERROR_TEXT.offlineChange, {
        description: REMINDER_ERROR_TEXT.offlineChangeDetail,
      });
      return;
    }
    switch (reminderErrorCode(error)) {
      case 'REMINDER_FINISHED':
        toast.error(REMINDER_ERROR_TEXT.finished);
        return;
      case 'REMINDER_NOT_FOUND':
        toast.error(REMINDER_ERROR_TEXT.notFound);
        return;
      case 'REMINDER_CONFLICT':
        toast.error(REMINDER_ERROR_TEXT.conflict);
        return;
      default:
        toast.error(REMINDER_ERROR_TEXT.genericChange);
    }
  };

  const setPaused = (paused: boolean) => {
    const action: ReminderToggleAction = paused ? 'pause' : 'resume';
    toggle.mutate({ id: reminder.id, action }, { onError: reportChangeError });
  };

  const deleteReminder = () => {
    remove.mutate(reminder.id, {
      onError: (error) => {
        if (isNetworkError(error)) {
          toast.error(REMINDER_ERROR_TEXT.offlineChange, {
            description: REMINDER_ERROR_TEXT.offlineChangeDetail,
          });
          return;
        }
        // Ya no estaba: la lista se relee sola (la mutación invalida al terminar).
        if (reminderErrorCode(error) === 'REMINDER_NOT_FOUND') return;
        toast.error(REMINDER_ERROR_TEXT.genericDelete);
      },
    });
  };

  /** Estado manual que pinta el interruptor: el pedido mientras va, el del servidor si no. */
  const manualActive = toggle.isPending
    ? toggle.variables?.action === 'resume'
    : reminder.status === 'ACTIVE';

  return {
    manualActive,
    togglePending: toggle.isPending,
    setPaused,
    deleteReminder,
    deleting: remove.isPending,
  };
}
