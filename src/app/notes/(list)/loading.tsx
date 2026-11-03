import { getTranslations } from 'next-intl/server'
import { Skeleton } from '@/components/ui/skeleton'

/** Shown while the server prefetches the notes (navigation to /notes). */
export default async function NotesLoading() {
    const t = await getTranslations('notes')
    return (
        <div
            className="grid gap-8"
            aria-busy="true"
        >
            <header className="grid gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{t('heading')}</h1>
                <p
                    role="status"
                    className="text-muted-foreground"
                >
                    {t('list.loading')}
                </p>
            </header>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="grid gap-3">
                    {Array.from(
                        {
                            length: 5,
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
                <div className="grid content-start gap-6">
                    <Skeleton className="h-72" />
                    <Skeleton className="h-32" />
                </div>
            </div>
        </div>
    )
}
