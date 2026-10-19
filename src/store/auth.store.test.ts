import { afterEach, describe, expect, it } from 'vitest';

import { queryClient } from '@/core/query/query-client';
import { useAuthStore, type User } from '@/store/auth.store';

const user: User = {
  id: 'u1',
  name: 'Persona A',
  email: 'a@qleo.test',
  role: 'MEMBER',
  status: 'ACTIVE',
};

describe('useAuthStore.logout', () => {
  afterEach(() => queryClient.clear());

  it('vacía la caché de TanStack Query para que la siguiente cuenta no vea datos de la anterior', () => {
    useAuthStore.getState().setCredentials('token-a', user);
    queryClient.setQueryData(['reminders', 'list'], [{ id: 'r1', title: 'Privado de A' }]);
    queryClient.setQueryData(['notifications'], [{ id: 'n1' }]);

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(['reminders', 'list'])).toBeUndefined();
  });
});
