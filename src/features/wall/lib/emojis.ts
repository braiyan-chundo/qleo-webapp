/**
 * Set curado de emojis Unicode para el picker del muro (QL-90). **Sin dependencia externa y
 * sin red**: son literales Unicode que se insertan tal cual en el `body` (texto plano), lo
 * que respeta la CSP/offline y no añade peso de librería al bundle. Reacciones a mensajes →
 * fuera de alcance (posible fase 2, ver ANALISIS §7).
 */

export interface EmojiCategory {
  /** Etiqueta accesible de la categoría (título del grupo). */
  label: string;
  /** Emoji representativo, usado como icono de la pestaña. */
  icon: string;
  /** Emojis de la categoría (literales Unicode). */
  emojis: readonly string[];
}

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  {
    label: 'Caras',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤗', '🤔', '🤨', '😐', '😑',
      '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '😴', '😷',
      '🤒', '🤕', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮',
      '😯', '😳', '🥺', '😢', '😭', '😤', '😠', '😡', '🥱', '🤯',
    ],
  },
  {
    label: 'Gestos',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌',
      '👐', '🤝', '🙏', '✊', '👊', '🤛', '🤜', '👋', '🤚', '✋',
      '🖐️', '👆', '👇', '👉', '👈', '💪', '🫶', '🤙', '👀', '🫡',
    ],
  },
  {
    label: 'Corazones',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯', '💥',
    ],
  },
  {
    label: 'Objetos',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎂', '🎁', '🏆', '🥇', '🚀', '💡', '📌',
      '📎', '📝', '📅', '📈', '📉', '📊', '💼', '📁', '📂', '🔔',
      '⏰', '⌛', '✅', '❌', '⚠️', '❓', '❗', '💬', '📣', '🔥',
    ],
  },
  {
    label: 'Naturaleza',
    icon: '🌍',
    emojis: [
      '🌍', '🌞', '🌙', '⭐', '🌟', '✨', '⚡', '☀️', '⛅', '☁️',
      '🌈', '❄️', '🍀', '🌸', '🌺', '🌻', '🌴', '🌵', '🍎', '🍕',
      '☕', '🍔', '🍰', '🍺', '🥂', '🎵', '⚽', '✈️', '🏝️', '🐶',
    ],
  },
];
