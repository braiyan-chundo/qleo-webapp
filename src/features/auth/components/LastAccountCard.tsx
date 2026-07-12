import { ChevronRight } from 'lucide-react';

import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import type { LastAccount } from '../lib/last-account';

interface LastAccountCardProps {
  account: LastAccount;
  onSelect: () => void;
}

/**
 * Tarjeta "¿Esta es tu cuenta?" del login (QL-44). Muestra el avatar (data URL cacheado /
 * URL externa / iniciales) y el nombre de la última cuenta. Al pulsarla, la página precarga
 * el email y enfoca la contraseña.
 */
export function LastAccountCard({ account, onSelect }: LastAccountCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-2.5 sm:p-3 text-left transition-all hover:border-primary/40 hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <AuthedAvatar
        avatarUrl={account.avatar}
        name={account.name}
        className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 border border-outline-variant/50"
        fallbackClassName={identityAvatarFallback}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{account.name}</p>
        <p className="truncate text-xs text-on-surface-variant">{account.email}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-outline transition-colors group-hover:text-primary" />
    </button>
  );
}
