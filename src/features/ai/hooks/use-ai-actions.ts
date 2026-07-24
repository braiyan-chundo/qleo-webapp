import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from '@/features/tasks/hooks/use-tasks';
import { projectKeys } from '@/features/projects/hooks/use-projects';
import { columnKeys } from '@/features/columns/hooks/use-columns';
import { commentKeys } from '@/features/comments/hooks/use-comments';
import { checklistKeys } from '@/features/checklists/hooks/use-checklist';
import { auditKeys } from '@/features/audit/hooks/use-audit';

import { aiActionsService } from '../services/ai-actions.service';

/**
 * Hooks de las **acciones de escritura** propuestas por el asistente (QL-190, §3.64).
 *
 * Confirmar puede tocar cualquier cosa (crear/editar/mover/asignar tarea, comentar, checklist, crear
 * proyecto), así que al ejecutar **invalidamos en amplio** las raíces de las queries afectadas para
 * que lo creado/editado aparezca sin recargar (kanban, detalle de tarea, proyectos, auditoría…). La
 * invalidación de TanStack Query solo refetchea lo que esté **activo**, así que es barata.
 */
function invalidateDomainRoots(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
  queryClient.invalidateQueries({ queryKey: projectKeys.all });
  queryClient.invalidateQueries({ queryKey: columnKeys.all });
  queryClient.invalidateQueries({ queryKey: commentKeys.all });
  queryClient.invalidateQueries({ queryKey: checklistKeys.all });
  queryClient.invalidateQueries({ queryKey: auditKeys.all });
}

/** Confirma (ejecuta) una acción propuesta. Idempotente. Invalida el dominio afectado al éxito. */
export function useConfirmAiAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) => aiActionsService.confirm(actionId),
    onSuccess: () => invalidateDomainRoots(queryClient),
  });
}

/** Descarta una acción propuesta (no muta dominio, no invalida). */
export function useCancelAiAction() {
  return useMutation({
    mutationFn: (actionId: string) => aiActionsService.cancel(actionId),
  });
}

/**
 * Confirma (ejecuta) un **plan multi-acción** (QL-78). `exclude` son los índices 1-based a omitir. Un
 * plan puede tocar cualquier dominio, así que invalidamos en amplio igual que una acción suelta.
 */
export function useConfirmAiPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, exclude }: { planId: string; exclude: number[] }) =>
      aiActionsService.confirmPlan(planId, exclude),
    onSuccess: () => invalidateDomainRoots(queryClient),
  });
}

/** Descarta un plan multi-acción completo (no ejecuta ningún paso, no invalida). */
export function useCancelAiPlan() {
  return useMutation({
    mutationFn: (planId: string) => aiActionsService.cancelPlan(planId),
  });
}
