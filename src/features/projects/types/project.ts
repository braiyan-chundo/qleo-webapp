import type { Label } from '@/features/labels/services/labels.service';

/**
 * Clave de la paleta de color de un proyecto (QL-29, §3.4), o `null` = sin color.
 * Comparte la misma paleta que las columnas (`ColumnColor`).
 */
export type ProjectColor =
  | 'blue'
  | 'orange'
  | 'green'
  | 'purple'
  | 'red'
  | 'pink'
  | 'gray';

/**
 * Estado **derivado** (no persistido) de un proyecto (QL-37, §3.4). Precedencia:
 * `archived`→`CLOSING`, 100%→`COMPLETED`, >0%→`ACTIVE`, resto→`PLANNING`.
 */
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'CLOSING' | 'COMPLETED';

/**
 * Miembro de un proyecto. Tiene **doble semántica** según el endpoint (§3.4/§3.20):
 * - En la **lista** (`GET /projects`): hasta 4 **participantes** de tareas (avatar-group QL-37).
 * - En el **detalle** (`GET /projects/:id`) y los endpoints de miembros (§3.20, QL-51):
 *   la **membresía real completa** del proyecto (sin cap de 4).
 * `avatarDownloadUrl` es el proxy privado `/users/:id/avatar` (usar con `AuthedAvatar`,
 * QL-32) o `null` si no tiene avatar subido → iniciales de `name`.
 */
export interface ProjectMember {
  id: string;
  name: string;
  avatarDownloadUrl: string | null;
}

/**
 * DTO de respuesta del backend para un proyecto (QL-04, §3.4).
 *
 * Los campos de QL-37 (`taskCounts`, `progressPct`, `status`) solo llegan con valores
 * reales en la **lista** (`GET /projects`); en `GET /projects/:id` y las mutaciones existen
 * por consistencia de tipo pero con valores neutros. En cambio, desde **QL-51** los campos
 * `members`/`memberCount` en el detalle y los endpoints de miembros traen la **membresía real**.
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  code?: string;
  clientGroup?: string;
  startDate?: string;
  endDate?: string;
  /** Color distintivo del proyecto (QL-29), o `null` si no tiene. */
  color: ProjectColor | null;
  archived: boolean;
  /**
   * (QL-61) Si es `false`, la columna Backlog y sus tareas se ocultan a los miembros que no
   * son el creador ni ADMIN. Default `true`. Editable vía `PATCH /projects/:id`.
   */
  showBacklogToMembers: boolean;
  /**
   * (P7, §3.4) Antelación en **horas** del aviso "deadline próximo" al Responsable de una
   * tarea abierta. Default `24`. Editable con `PATCH /projects/:id` (rango 1–720).
   */
  deadlineWarningHours: number;
  createdBy: string;
  createdAt: string;
  /**
   * (P2/§3.20) IDs de miembros con **permiso de gestión otorgado** (managers): pueden
   * editar/archivar/configurar el proyecto y subir documentos, pero NO gestionar la
   * membresía ni otorgar/revocar managers. El **creador** y los **ADMIN** siempre pueden
   * gestionar aunque no aparezcan aquí. Presente en todas las respuestas de `Project`.
   */
  managerIds: string[];
  /** (QL-37) Tareas del proyecto; `done` = completadas (`completedAt != null`). */
  taskCounts: { total: number; done: number };
  /** (QL-37) `round(done/total*100)`, `0` si `total=0`. Rango 0–100. */
  progressPct: number;
  /**
   * (QL-146, §3.38) Ids de las etiquetas del catálogo **adoptadas** por el proyecto. Las tareas
   * solo pueden referenciar etiquetas de este set (`LABEL_NOT_IN_PROJECT` en caso contrario).
   */
  labelIds: string[];
  /** (QL-146, §3.38) Las mismas etiquetas ya RESUELTAS (para pintar chips y el selector). */
  labels: Label[];
  /** Lista (QL-37): hasta 4 participantes de tareas. Detalle (QL-51): membresía real completa. */
  members: ProjectMember[];
  /** Lista: nº de participantes (para el "+N"). Detalle (QL-51): nº de miembros reales. */
  memberCount: number;
  /** (QL-37) Estado derivado (no persistido). */
  status: ProjectStatus;
}
