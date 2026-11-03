import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { type ApiClient } from './client'
import { type CreateNoteInput, type ListNotesQuery, type Note, type NotePage, type NoteStats } from './types'

export const NOTES_PAGE_SIZE = 20

/** Endpoints of the notes resource. The client is passed in: server or browser. */
export const notesApi = {
    list: (api: ApiClient, query: ListNotesQuery = {}, signal?: AbortSignal) =>
        api.request<NotePage>('/api/v1/notes', {
            query,
            signal,
        }),
    get: (api: ApiClient, id: string, signal?: AbortSignal) =>
        api.request<Note>(`/api/v1/notes/${encodeURIComponent(id)}`, {
            signal,
        }),
    create: (api: ApiClient, input: CreateNoteInput) =>
        api.request<Note>('/api/v1/notes', {
            method: 'POST',
            body: input,
        }),
    stats: (api: ApiClient, signal?: AbortSignal) =>
        api.request<NoteStats>('/api/v1/notes/stats', {
            signal,
        }),
}

/**
 * Query keys, broad to narrow: invalidating `noteKeys.all` refreshes
 * everything about notes, `noteKeys.lists()` every list.
 */
export const noteKeys = {
    all: [
        'notes',
    ] as const,
    lists: () =>
        [
            ...noteKeys.all,
            'list',
        ] as const,
    list: (limit: number) =>
        [
            ...noteKeys.lists(),
            {
                limit,
            },
        ] as const,
    details: () =>
        [
            ...noteKeys.all,
            'detail',
        ] as const,
    detail: (id: string) =>
        [
            ...noteKeys.details(),
            id,
        ] as const,
    stats: () =>
        [
            ...noteKeys.all,
            'stats',
        ] as const,
    create: () =>
        [
            ...noteKeys.all,
            'create',
        ] as const,
}

/**
 * Options shared by server prefetch and client hooks: the same key, a
 * queryFn bound to whichever client runs it.
 */
export const noteQueries = {
    list: (api: ApiClient, limit = NOTES_PAGE_SIZE) =>
        infiniteQueryOptions({
            queryKey: noteKeys.list(limit),
            queryFn: ({ pageParam, signal }) =>
                notesApi.list(
                    api,
                    {
                        limit,
                        cursor: pageParam ?? undefined,
                    },
                    signal,
                ),
            initialPageParam: null as string | null,
            getNextPageParam: lastPage => lastPage.nextCursor,
        }),
    detail: (api: ApiClient, id: string) =>
        queryOptions({
            queryKey: noteKeys.detail(id),
            queryFn: ({ signal }) => notesApi.get(api, id, signal),
        }),
    stats: (api: ApiClient) =>
        queryOptions({
            queryKey: noteKeys.stats(),
            queryFn: ({ signal }) => notesApi.stats(api, signal),
        }),
}
