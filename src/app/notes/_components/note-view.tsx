'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { browserApi } from '@/lib/api/browser'
import { noteQueries } from '@/lib/api/notes'
import { useNoteDate } from './note-date'

/** The note from the hydrated cache; refetches in the background when stale. */
export function NoteView({ id }: { id: string }) {
    const t = useTranslations('notes.detail')
    const formatDate = useNoteDate()
    const { data: note } = useQuery(noteQueries.detail(browserApi, id))
    if (!note) return null
    return (
        <article className="grid max-w-3xl gap-4">
            <Link
                href="/notes"
                className="text-sm text-primary underline underline-offset-4 hover:no-underline"
            >
                ← {t('back')}
            </Link>
            <h1 className="text-3xl font-bold tracking-tight break-words">{note.title}</h1>
            <p className="text-sm text-muted-foreground">
                {t.rich('createdAt', {
                    date: formatDate(note.createdAt),
                    time: chunks => <time dateTime={note.createdAt}>{chunks}</time>,
                })}
            </p>
            {note.body ? (
                <p className="whitespace-pre-wrap">{note.body}</p>
            ) : (
                <p className="text-muted-foreground">{t('emptyBody')}</p>
            )}
        </article>
    )
}
