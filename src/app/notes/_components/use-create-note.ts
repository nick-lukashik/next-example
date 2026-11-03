'use client'

import { type InfiniteData, useMutation } from '@tanstack/react-query'
import { browserApi } from '@/lib/api/browser'
import { noteKeys, notesApi } from '@/lib/api/notes'
import { type CreateNoteInput, type Note, type NotePage, type NoteStats } from '@/lib/api/types'

const OPTIMISTIC_PREFIX = 'optimistic-'

/** A note shown before the server confirmed it (no link, "Saving…"). */
export const isOptimistic = (note: Note) => note.id.startsWith(OPTIMISTIC_PREFIX)

/** What onMutate hands to the other callbacks and to useMutationState readers. */
export type CreateNoteContext = {
    optimisticId: string
    /** Stats total before the create: NotesStats polls until it moves. */
    statsBefore: number | undefined
}

type Pages = InfiniteData<NotePage, string | null>

const mapPages = (data: Pages | undefined, update: (items: Note[], index: number) => Note[]) =>
    data && {
        ...data,
        pages: data.pages.map((page, index) => ({
            ...page,
            items: update(page.items, index),
        })),
    }

let sequence = 0

/**
 * Create with an optimistic insert: the note appears at the top of every
 * cached list at once, is swapped for the server's version on success and
 * removed again on error. Removing by id (not restoring a snapshot) keeps
 * other changes made meanwhile.
 */
export function useCreateNote() {
    return useMutation({
        mutationKey: noteKeys.create(),
        mutationFn: (input: CreateNoteInput) => notesApi.create(browserApi, input),
        onMutate: async (input, { client }): Promise<CreateNoteContext> => {
            // A list fetch in flight would overwrite the optimistic note.
            await client.cancelQueries({
                queryKey: noteKeys.lists(),
            })
            sequence += 1
            const optimistic: Note = {
                id: `${OPTIMISTIC_PREFIX}${Date.now()}-${sequence}`,
                title: input.title,
                body: input.body,
                createdAt: new Date().toISOString(),
            }
            client.setQueriesData<Pages>(
                {
                    queryKey: noteKeys.lists(),
                },
                data =>
                    mapPages(data, (items, index) =>
                        index === 0
                            ? [
                                  optimistic,
                                  ...items,
                              ]
                            : items,
                    ),
            )
            return {
                optimisticId: optimistic.id,
                statsBefore: client.getQueryData<NoteStats>(noteKeys.stats())?.total,
            }
        },
        onSuccess: (note, _input, context, { client }) => {
            client.setQueriesData<Pages>(
                {
                    queryKey: noteKeys.lists(),
                },
                data => mapPages(data, items => items.map(item => (item.id === context.optimisticId ? note : item))),
            )
            client.setQueryData(noteKeys.detail(note.id), note)
        },
        onError: (_error, _input, context, { client }) => {
            if (!context) return
            client.setQueriesData<Pages>(
                {
                    queryKey: noteKeys.lists(),
                },
                data => mapPages(data, items => items.filter(item => item.id !== context.optimisticId)),
            )
        },
        onSettled: (_note, _error, _input, _context, { client }) =>
            Promise.all([
                client.invalidateQueries({
                    queryKey: noteKeys.lists(),
                }),
                client.invalidateQueries({
                    queryKey: noteKeys.stats(),
                }),
            ]),
    })
}
