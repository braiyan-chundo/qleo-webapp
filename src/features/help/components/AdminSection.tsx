import { Link } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  FolderPlus,
  History,
  LifeBuoy,
  Pin,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import { Section, FeatureList, type HelpFeature } from './HelpPrimitives';

/**
 * Pestaña «Administración» de la Ayuda (QL-128). **Solo la ve un ADMIN de plataforma**: el
 * filtro está en `HELP_TABS` (`adminOnly`), y cada `Section` lo repite por si acaso.
 *
 * Documenta lo que es **exclusivo** del rol ADMIN, verificado contra el código: rutas
 * `adminOnly` del nav (`shared/config/nav.ts`) con guard `AdminRoute`, el gating por
 * `role === 'ADMIN'` del muro y del análisis de tarea, y los ajustes globales (QL-129).
 * Lo que un creador/gestor de proyecto también puede hacer va aparte, al final, para no
 * confundir «solo ADMIN» con «ADMIN o creador».
 */
const ADMIN_TOOLS: HelpFeature[] = [
  {
    icon: <Users className="size-4 text-primary" />,
    term: 'Administración de usuarios',
    desc: (
      <>
        En{' '}
        <Link to="/admin" className="font-medium text-primary hover:underline">
          Administración
        </Link>{' '}
        das de alta usuarios («Nuevo usuario»), editas su nombre, cargo, rol y contraseña, y
        los buscas o filtras por rol y estado.
      </>
    ),
  },
  {
    icon: <UserPlus className="size-4 text-primary" />,
    term: 'Activar y desactivar',
    desc: 'Un usuario no se elimina: se desactiva (pasa a «Inactivo») y deja de poder entrar. Sus datos y su rastro se conservan.',
  },
  {
    icon: <BarChart3 className="size-4 text-primary" />,
    term: 'Analíticas',
    desc: (
      <>
        En{' '}
        <Link to="/analytics" className="font-medium text-primary hover:underline">
          Analíticas
        </Link>
        , el «Resumen del sistema» y el «Rendimiento por usuario» son solo tuyos. El bloque
        «Por proyecto» lo consulta también el creador de cada proyecto, pero solo de los
        suyos.
      </>
    ),
  },
  {
    icon: <History className="size-4 text-primary" />,
    term: 'Auditoría',
    desc: (
      <>
        El{' '}
        <Link to="/audit" className="font-medium text-primary hover:underline">
          Historial de cambios
        </Link>{' '}
        registra automáticamente quién hizo qué y cuándo. Puedes filtrarlo por tipo de
        entidad.
      </>
    ),
  },
  {
    icon: <CalendarDays className="size-4 text-primary" />,
    term: 'Calendario laboral',
    desc: (
      <>
        En{' '}
        <Link to="/calendar" className="font-medium text-primary hover:underline">
          Calendario
        </Link>{' '}
        defines los festivos y los días de fin de semana. Es lo que hace que Qleo avise
        cuando una fecha límite cae en un día no laborable.
      </>
    ),
  },
  {
    icon: <BarChart3 className="size-4 text-primary" />,
    term: 'Análisis de una tarea',
    desc: 'Al abrir la vista completa de una tarea, debajo del detalle te aparece un bloque de análisis que un miembro no ve.',
  },
  {
    icon: <Pin className="size-4 text-primary" />,
    term: 'Fijar en el muro',
    desc: 'Solo tú puedes fijar y desfijar mensajes del muro. Los fijados los ve todo el equipo; lo exclusivo es la acción de fijar.',
  },
  {
    icon: <LifeBuoy className="size-4 text-primary" />,
    term: 'Correo de soporte',
    desc: 'La dirección de contacto del equipo se edita en la pestaña «Soporte» de esta misma Ayuda, con el botón «Editar».',
  },
];

export function AdminSection() {
  return (
    <div className="space-y-6">
      <Section
        icon={<ShieldCheck className="size-5" />}
        title="Tu área de administración"
        description="Lo que puedes hacer por ser Administrador de plataforma. Nada de esta pestaña la ve un miembro."
        adminOnly
      >
        <FeatureList items={ADMIN_TOOLS} />
      </Section>

      <Section
        icon={<FolderPlus className="size-5" />}
        title="Quién puede crear proyectos"
        description="Crear proyectos es un permiso que concedes tú."
        adminOnly
      >
        <div className="space-y-3 text-sm text-on-surface-variant">
          <p>
            Un <span className="font-medium text-on-surface">Administrador</span> siempre
            puede crear proyectos. Un{' '}
            <span className="font-medium text-on-surface">Miembro</span> solo puede si se lo
            concedes: por defecto <span className="font-medium text-on-surface">no</span>{' '}
            puede, y sin el permiso ni siquiera le aparece el botón «Nuevo proyecto».
          </p>
          <p className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
            Para concederlo: entra en{' '}
            <Link to="/admin" className="font-medium text-primary hover:underline">
              Administración
            </Link>
            , pulsa «Editar» en el usuario y activa{' '}
            <span className="font-medium text-on-surface">«Puede crear proyectos»</span>. Se
            puede revocar igual de fácil. Si un miembro te dice que no ve el botón, es esto.
          </p>
        </div>
      </Section>

      <Section
        icon={<Users className="size-5" />}
        title="Esto NO es exclusivo tuyo"
        description="Acciones que también puede hacer alguien sin ser Administrador. Conviene no confundirlas."
        adminOnly
      >
        <ul className="space-y-2 text-sm text-on-surface-variant">
          <li>
            <span className="font-medium text-on-surface">
              Configurar el tablero, editar y archivar un proyecto:
            </span>{' '}
            tú, el creador del proyecto o cualquiera a quien el creador haya nombrado{' '}
            <span className="font-medium text-on-surface">Gestor</span>.
          </li>
          <li>
            <span className="font-medium text-on-surface">
              Añadir o quitar miembros y nombrar gestores:
            </span>{' '}
            tú o el creador del proyecto (un gestor no puede).
          </li>
          <li>
            <span className="font-medium text-on-surface">
              Subir documentos del proyecto:
            </span>{' '}
            tú o el creador del proyecto. Además, cada quien puede borrar lo que subió.
          </li>
        </ul>
        <p className="mt-4 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Y recuerda que los cuatro roles{' '}
          <span className="font-medium text-on-surface">por tarea</span>{' '}
          (Creador/Responsable/Colaborador/Observador) van por su cuenta: ser Administrador
          no te da ningún rol dentro de una tarea. Los tienes en la pestaña{' '}
          <span className="font-medium text-on-surface">Roles</span>.
        </p>
      </Section>
    </div>
  );
}
