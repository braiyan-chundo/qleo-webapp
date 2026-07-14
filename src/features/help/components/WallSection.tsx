import { Link } from 'react-router-dom';
import {
  AtSign,
  BellOff,
  MessagesSquare,
  Mic,
  Paperclip,
  Pin,
  Radio,
  Reply,
  Search,
  Send,
  SquareStack,
} from 'lucide-react';

import { Section, FeatureList, type HelpFeature } from './HelpPrimitives';

/** Funciones del Muro Corporativo (verificadas en `features/wall`). */
const WALL_TOPICS: HelpFeature[] = [
  {
    icon: <MessagesSquare className="size-4 text-primary" />,
    term: 'Qué es',
    desc: (
      <>
        Un canal único para todo el equipo, en{' '}
        <Link to="/muro" className="font-medium text-primary hover:underline">
          Muro
        </Link>
        : anuncios, novedades y conversación abierta a la vista de todos.
      </>
    ),
  },
  {
    icon: <Send className="size-4 text-primary" />,
    term: 'Publicar',
    desc: 'Escribe en la barra inferior y pulsa enviar (o Enter). Usa Shift + Enter para saltar de línea sin enviar.',
  },
  {
    icon: <AtSign className="size-4 text-primary" />,
    term: 'Menciones',
    desc: 'Escribe «@» y elige a alguien para avisarle. La persona mencionada aparece resaltada y recibe notificación (incluso si silenció el muro).',
  },
  {
    icon: <Paperclip className="size-4 text-primary" />,
    term: 'Adjuntos',
    desc: 'Pulsa «+» para adjuntar. Según el dispositivo podrás elegir archivo, foto o vídeo, galería o cámara.',
  },
  {
    icon: <Mic className="size-4 text-primary" />,
    term: 'Notas de voz',
    desc: 'Graba y envía un mensaje de audio cuando escribir no sea cómodo. Se reproduce dentro de la conversación.',
  },
  {
    icon: <Reply className="size-4 text-primary" />,
    term: 'Responder',
    desc: 'Cita un mensaje para responderlo en contexto; se muestra a qué mensaje contestas para no perder el hilo.',
  },
  {
    icon: <Pin className="size-4 text-primary" />,
    term: 'Fijados',
    desc: 'Solo un Administrador puede fijar (o desfijar) mensajes destacados para que queden accesibles arriba.',
  },
  {
    icon: <Search className="size-4 text-primary" />,
    term: 'Buscar y saltar',
    desc: 'Busca entre los mensajes del muro y salta directamente al resultado dentro de la conversación.',
  },
  {
    icon: <Radio className="size-4 text-primary" />,
    term: '· N en línea',
    desc: 'Junto al título verás cuántas personas están conectadas al muro en ese momento (presencia en vivo).',
  },
  {
    icon: <MessagesSquare className="size-4 text-primary" />,
    term: '«Escribiendo…»',
    desc: 'Un indicador efímero muestra cuándo alguien está escribiendo o grabando un audio, al estilo de una app de mensajería.',
  },
  {
    icon: <SquareStack className="size-4 text-primary" />,
    term: 'Contenido compartido',
    desc: 'Un panel reúne los archivos e imágenes compartidos en el muro para encontrarlos rápido.',
  },
  {
    icon: <BellOff className="size-4 text-primary" />,
    term: 'No leídos y silenciar',
    desc: (
      <>
        El menú indica cuántos mensajes no has leído. Desde{' '}
        <Link to="/profile" className="font-medium text-primary hover:underline">
          Mi cuenta
        </Link>{' '}
        puedes silenciar el muro: dejarás de recibir el aviso de cada mensaje, pero las
        menciones seguirán llegando.
      </>
    ),
  },
];

export function WallSection() {
  return (
    <Section
      icon={<MessagesSquare className="size-5" />}
      title="Muro Corporativo"
      description="El canal del equipo: publica, menciona, adjunta, busca y mantente al día."
    >
      <FeatureList items={WALL_TOPICS} />
    </Section>
  );
}
