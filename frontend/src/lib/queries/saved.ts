'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Hydrate saved state for a whole page of content in one request.
 *
 * Each SaveButton reads ['xdtv','follow','post',id]. Left alone, a 24-card
 * wall would issue 24 checks; this seeds all of them from a single batch call
 * so the buttons render correct on first paint and fire nothing themselves.
 */
export function useSavedHydration(postIds: number[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sorted = [...postIds].sort((a, b) => a - b);
  const idParam = sorted.join(',');

  const { data } = useQuery({
    queryKey: ['xdtv', 'saved-batch', idParam],
    queryFn: async () => {
      const { data } = await api.get(`/follows/posts/check-batch?ids=${idParam}`);
      return data as Record<number, boolean>;
    },
    enabled: Boolean(user) && sorted.length > 0,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    // Seed every card's own key; ids absent from the response are not saved.
    for (const id of sorted) {
      queryClient.setQueryData(['xdtv', 'follow', 'post', id], Boolean(data[id]));
    }
    // idParam captures the id set; `data` captures the response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, idParam, queryClient]);
}
