import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { type Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { noteKeys } from '@/lib/api/notes'
import { getServerQueryClient } from '@/lib/query/server'
import { baseOpenGraph } from '@/lib/seo/metadata'
import { NoteView } from '../_components/note-view'
import { loadNote } from '../load-note'

const DESCRIPTION_LENGTH = 160

function excerpt(text: string) {
    const flat = text.replace(/\s+/g, ' ').trim()
    return flat.length > DESCRIPTION_LENGTH ? `${flat.slice(0, DESCRIPTION_LENGTH - 1)}…` : flat
}

export async function generateMetadata({ params }: PageProps<'/notes/[id]'>): Promise<Metadata> {
    const { id } = await params
    const [note, t] = await Promise.all([
        loadNote(id),
        getTranslations('notes.meta'),
    ])
    return {
        title: note.title,
        description: excerpt(note.body) || t('description'),
        // A page-level openGraph replaces the layout's: keep the shared fields.
        openGraph: {
            ...(await baseOpenGraph(`/notes/${encodeURIComponent(id)}`)),
            type: 'article',
            publishedTime: note.createdAt,
        },
    }
}

/**
 * No loading.tsx on purpose: a streamed shell would commit status 200 before
 * notFound() could answer 404. (The list's loading.tsx sits in the (list)
 * route group so it does not wrap this route.)
 */
export default async function NotePage({ params }: PageProps<'/notes/[id]'>) {
    const { id } = await params
    const note = await loadNote(id)
    // Seed the client cache with what the server already has: no second fetch.
    const queryClient = getServerQueryClient()
    queryClient.setQueryData(noteKeys.detail(id), note)
    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <NoteView id={id} />
        </HydrationBoundary>
    )
}
