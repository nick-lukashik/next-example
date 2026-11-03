'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2Icon } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { browserApi } from '@/lib/api/browser'
import { noteQueries } from '@/lib/api/notes'
import { type Note } from '@/lib/api/types'
import { NoteDate } from './note-date'
import { isOptimistic } from './use-create-note'

function NoteItem({ note, savingLabel }: { note: Note; savingLabel: string }) {
    const pending = isOptimistic(note)
    return (
        <li
            aria-busy={pending || undefined}
            className={pending ? 'opacity-70' : undefined}
        >
            <Card size="sm">
                <CardContent className="gap-1">
                    <h3 className="font-semibold break-words">
                        {pending ? (
                            note.title
                        ) : (
                            <Link
                                href={`/notes/${encodeURIComponent(note.id)}`}
                                className="underline-offset-4 hover:underline"
                            >
                                {note.title}
                            </Link>
                        )}
                    </h3>
                    {note.body && <p className="line-clamp-2 text-muted-foreground">{note.body}</p>}
                    <p className="text-xs text-muted-foreground">
                        {pending ? savingLabel : <NoteDate value={note.createdAt} />}
                    </p>
                </CardContent>
            </Card>
        </li>
    )
}

/** Cursor pagination with useInfiniteQuery; page 1 arrives hydrated from the server. */
export function NotesList() {
    const t = useTranslations('notes.list')
    const notes = useInfiniteQuery(noteQueries.list(browserApi))
    const items = notes.data?.pages.flatMap(page => page.items) ?? []

    return (
        <section
            aria-labelledby="notes-list-title"
            className="grid content-start gap-4"
        >
            <h2
                id="notes-list-title"
                className="text-xl font-semibold"
            >
                {t('title')}
            </h2>

            {notes.isPending && (
                <div className="grid gap-3">
                    <p
                        role="status"
                        className="sr-only"
                    >
                        {t('loading')}
                    </p>
                    {Array.from(
                        {
                            length: 4,
                        },
                        (_, index) => (
                            <Skeleton
                                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders, never reordered.
                                key={index}
                                className="h-20"
                            />
                        ),
                    )}
                </div>
            )}

            {notes.isError && !notes.data && (
                <div
                    role="alert"
                    className="grid justify-items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
                >
                    <p>{t('error')}</p>
                    <Button
                        variant="outline"
                        onClick={() => notes.refetch()}
                    >
                        {t('retry')}
                    </Button>
                </div>
            )}

            {notes.isSuccess && items.length === 0 && <p className="text-muted-foreground">{t('empty')}</p>}

            {items.length > 0 && (
                <ul
                    className="grid gap-3"
                    aria-label={t('title')}
                >
                    {items.map(note => (
                        <NoteItem
                            key={note.id}
                            note={note}
                            savingLabel={t('saving')}
                        />
                    ))}
                </ul>
            )}

            {notes.hasNextPage ? (
                <div>
                    {/* Stays focusable while loading (aria-disabled, not disabled). */}
                    <Button
                        variant="outline"
                        aria-busy={notes.isFetchingNextPage || undefined}
                        aria-disabled={notes.isFetchingNextPage || undefined}
                        onClick={() => {
                            if (!notes.isFetchingNextPage) notes.fetchNextPage()
                        }}
                    >
                        {notes.isFetchingNextPage && (
                            <Loader2Icon className="animate-spin motion-reduce:animate-none" />
                        )}
                        {notes.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
                    </Button>
                </div>
            ) : (
                notes.isSuccess && items.length > 0 && <p className="text-sm text-muted-foreground">{t('end')}</p>
            )}
            {notes.isFetchNextPageError && (
                <p
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {t('error')}
                </p>
            )}
        </section>
    )
}
