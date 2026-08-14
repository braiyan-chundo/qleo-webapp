import { Info, TriangleAlert } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import { useDirectiveUsers } from '@/features/users/hooks/use-users';

import { OPEN_ENDED_REASON_MAX } from '../../schemas/task.schema';

interface OpenEndedRequestFieldsProps {
  managerId: string;
  reason: string;
  onManagerChange: (id: string) => void;
  onReasonChange: (reason: string) => void;
  managerError?: string;
  reasonError?: string;
  disabled?: boolean;
}

/**
 * (QL-197, §3.69) Los dos campos de la **solicitud de fin abierto**: a quién de Dirección se le
 * pide y por qué. Van **juntos o ninguno** — el backend recibe un objeto
 * `openEndedRequest: { managerId, reason }`, no dos campos sueltos, para que no pueda llegar
 * media solicitud (un motivo sin directivo, o al revés).
 *
 * El selector se llena con `GET /users/directory/directives`, abierto a cualquier autenticado.
 * Existe justamente para esto: quien pide la autorización suele ser un MEMBER, y el listado de
 * usuarios con filtro de rol está reservado a Dirección. Todos ven la misma lista exacta, así
 * que aquí no hay caso degradado que atender.
 */
export function OpenEndedRequestFields({
  managerId,
  reason,
  onManagerChange,
  onReasonChange,
  managerError,
  reasonError,
  disabled,
}: OpenEndedRequestFieldsProps) {
  const directives = useDirectiveUsers();
  const isLoading = directives.isLoading;
  const candidates = directives.data ?? [];
  const isEmpty = !isLoading && candidates.length === 0;

  return (
    <div className="grid gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-3">
      <div className="grid gap-1.5">
        <Label htmlFor="openEndedManagerId" className="text-xs text-on-surface-variant">
          Directivo que autoriza <span className="text-error">*</span>
        </Label>
        <NativeSelect
          id="openEndedManagerId"
          className="w-full [&>select]:h-10"
          disabled={disabled || isLoading || isEmpty}
          value={managerId}
          onChange={(e) => onManagerChange(e.target.value)}
        >
          <NativeSelectOption value="">
            {isLoading ? 'Cargando…' : 'Elige a quién se lo pides'}
          </NativeSelectOption>
          {candidates.map((candidate) => (
            <NativeSelectOption key={candidate.id} value={candidate.id}>
              {candidate.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {managerError && (
          <span className="text-xs font-medium text-error">{managerError}</span>
        )}
        {isEmpty && (
          <span className="inline-flex items-start gap-1.5 text-xs text-error">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            No hay nadie a quien pedirle la autorización. Ponle una fecha de fin a la tarea o
            avisa a Administración.
          </span>
        )}
        {!isEmpty && (
          <span className="inline-flex items-start gap-1.5 text-xs text-on-surface-variant">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            La tarea quedará bloqueada hasta que esta persona la autorice.
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="openEndedReason" className="text-xs text-on-surface-variant">
          Motivo <span className="text-error">*</span>
        </Label>
        <Textarea
          id="openEndedReason"
          rows={3}
          maxLength={OPEN_ENDED_REASON_MAX}
          value={reason}
          disabled={disabled}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Por qué esta tarea no puede tener fecha de fin…"
          className={cn(reasonError && 'border-error')}
        />
        {reasonError && (
          <span className="text-xs font-medium text-error">{reasonError}</span>
        )}
      </div>
    </div>
  );
}
