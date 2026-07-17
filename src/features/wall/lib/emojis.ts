/**
 * Set curado de emojis Unicode para el picker del muro (QL-90). **Sin dependencia externa y
 * sin red**: son literales Unicode que se insertan tal cual en el `body` (texto plano), lo
 * que respeta la CSP/offline y no añade peso de librería al bundle. El mismo set alimenta el
 * picker ampliado de **reacciones** (QL-147, "más emojis").
 */

/**
 * (QL-147, §3.42) Barra rápida de reacciones estilo WhatsApp: el set común que aparece al
 * hacer hover (desktop) o long-press (móvil) sobre un mensaje, antes de abrir el picker
 * ampliado ("más emojis") con `EMOJI_CATEGORIES`.
 */
export const QUICK_REACTIONS: readonly string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
