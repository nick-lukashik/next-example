import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { type Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { noteQueries } from '@/lib/api/notes'
import { serverApi } from '@/lib/api/server'
import { getServerQueryClient } from '@/lib/query/server'
import { CreateNoteForm } from '../_components/create-note-form'
import { NotesList } from '../_components/notes-list'
import { NotesStats } from '../_components/notes-stats'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('notes.meta')
    return {
        title: t('title'),
        description: t('description'),
    }
}

const ignore = () => {}

/**
 * Server prefetch → HydrationBoundary → client queries. The first page and
 * the stats are in the HTML (crawlers see the notes); the client takes the
 * same cache over without refetching. A failed prefetch is not fatal: the
 * client components retry and show their own error state.
 */
export default async function NotesPage() {
    const [t, api] = await Promise.all([
        getTranslations('notes'),
        serverApi(),
    ])
    const queryClient = getServerQueryClient()
    await Promise.all([
        queryClient.infiniteQuery(noteQueries.list(api)).catch(ignore),
        queryClient.query(noteQueries.stats(api)).catch(ignore),
    ])

    return (
        <div className="grid gap-8">
            <header className="grid gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{t('heading')}</h1>
                <p className="max-w-2xl text-muted-foreground">{t('lead')}</p>
            </header>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <NotesList />
                    <aside className="grid content-start gap-6">
                        <CreateNoteForm />
                        <NotesStats />
                    </aside>
                </div>
            </HydrationBoundary>
        </div>
    )
}
