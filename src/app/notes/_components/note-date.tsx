'use client'

import { useFormatter } from 'next-intl'

const OPTIONS = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
} as const

/** Formats a note timestamp in the reader's language (UTC on both sides, see i18n/request.ts). */
export function useNoteDate() {
    const format = useFormatter()
    return (value: string) => format.dateTime(new Date(value), OPTIONS)
}

export function NoteDate({ value }: { value: string }) {
    const formatDate = useNoteDate()
    return <time dateTime={value}>{formatDate(value)}</time>
}
