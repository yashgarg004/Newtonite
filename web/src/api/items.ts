import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client';

export interface WorkItem {
  id: string;
  team_id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  assignee_id: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: bigint;
  actor_id: string | null;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  payload: unknown;
  created_at: string;
}

export function useItems(params: { teamId?: string; status?: string; priority?: string; q?: string; cursor?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params.teamId) searchParams.set('teamId', params.teamId);
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.q) searchParams.set('q', params.q);
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  return useQuery({
    queryKey: ['items', searchParams.toString()],
    queryFn: () => apiFetch<{ items: WorkItem[]; nextCursor: string | null }>(`/items?${searchParams.toString()}`),
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => apiFetch<WorkItem>(`/items/${id}`),
    enabled: !!id,
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: () => apiFetch<ActivityEvent[]>(`/items/${id}/activity`),
    enabled: !!id,
  });
}

export function useClaimItem(onError: (err: ApiError) => void, currentUserId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<WorkItem>(`/items/${id}/claim`, { method: 'POST' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['item', id] });
      const previous = queryClient.getQueryData<WorkItem>(['item', id]);
      queryClient.setQueryData<WorkItem>(['item', id], (old) => 
        old ? { ...old, assignee_id: currentUserId, status: 'in_progress' } : old
      );
      return { previous };
    },
    onError: (err: ApiError, id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['item', id], ctx.previous);
      onError(err);
    },
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ['item', id] });
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useTransitionItem(onError: (err: ApiError) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, version }: { id: string; to: string; version: number }) =>
      apiFetch<WorkItem>(`/items/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ to, version }),
      }),
    onMutate: async ({ id, to, version }) => {
      await queryClient.cancelQueries({ queryKey: ['item', id] });
      const previous = queryClient.getQueryData<WorkItem>(['item', id]);
      queryClient.setQueryData<WorkItem>(['item', id], (old) => 
        old ? { ...old, status: to, version: version + 1 } : old
      );
      return { previous };
    },
    onError: (err: ApiError, variables, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['item', variables.id], ctx.previous);
      onError(err);
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['activity', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useUpdateItem(onError: (err: ApiError) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, title, description, priority }: { id: string; version: number; title?: string; description?: string; priority?: string }) =>
      apiFetch<WorkItem>(`/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ version, title, description, priority }),
      }),
    onMutate: async ({ id, title, description, priority, version }) => {
      await queryClient.cancelQueries({ queryKey: ['item', id] });
      const previous = queryClient.getQueryData<WorkItem>(['item', id]);
      queryClient.setQueryData<WorkItem>(['item', id], (old) => 
        old ? { ...old, title: title ?? old.title, description: description ?? old.description, priority: priority ?? old.priority, version: version + 1 } : old
      );
      return { previous };
    },
    onError: (err: ApiError, variables, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['item', variables.id], ctx.previous);
      onError(err);
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['activity', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useAddComment(onError: (err: ApiError) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch(`/items/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    onError: (err: ApiError) => {
      onError(err);
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activity', variables.id] });
    },
  });
}

export function useCreateItem(onError: (err: ApiError) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      title,
      description,
      type,
      priority,
      idempotencyKey,
    }: {
      teamId: string;
      title: string;
      description?: string;
      type: string;
      priority?: string;
      idempotencyKey: string;
    }) =>
      apiFetch<WorkItem>('/items', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          teamId,
          title,
          description: description || undefined,
          type,
          priority: priority || undefined,
        }),
      }),
    onError: (err: ApiError) => {
      onError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}