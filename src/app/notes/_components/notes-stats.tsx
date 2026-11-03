'use client'

import { useMutationState, useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { browserApi } from '@/lib/api/browser'
import { noteKeys, noteQueries } from '@/lib/api/notes'
import { type CreateNoteContext } from './use-create-note'

const POLL_MS = 1000
/** Give up waiting for the backend's async counter after this long. */
const POLL_LIMIT_MS = 30_000

type LastCreate = {
    submittedAt: number
    statsBefore: number | undefined
}

/**
 * The backend recounts stats a few seconds after a create. Each create
 * records the total it saw (see useCreateNote); while the total has not
 * moved past it, the query polls every second.
 */
export function NotesStats() {
    const t = useTranslations('notes.stats')
    const format = useFormatter()
    const lastCreate = useMutationState({
        filters: {
            mutationKey: noteKeys.create(),
            status: 'success',
        },
        select: (mutation): LastCreate => ({
            submittedAt: mutation.state.submittedAt,
            statsBefore: (mutation.state.context as CreateNoteContext | undefined)?.statsBefore,
        }),
    }).at(-1)

    const waitingSince = (total: number | undefined, updatedAt: number) =>
        lastCreate?.statsBefore !== undefined
        && total !== undefined
        && total <= lastCreate.statsBefore
        && updatedAt - lastCreate.submittedAt < POLL_LIMIT_MS

    const stats = useQuery({
        ...noteQueries.stats(browserApi),
        refetchInterval: query => (waitingSince(query.state.data?.total, query.state.dataUpdatedAt) ? POLL_MS : false),
    })
    const updating = waitingSince(stats.data?.total, stats.dataUpdatedAt)

    return (
        <Card
            aria-labelledby="notes-stats-title"
            role="region"
        >
            <CardHeader className="flex items-baseline justify-between gap-2">
                <CardTitle>
                    <h2 id="notes-stats-title">{t('title')}</h2>
                </CardTitle>
                <p
                    role="status"
                    className="text-muted-foreground"
                >
                    {updating ? t('updating') : ''}
                </p>
            </CardHeader>
            <CardContent>
                {stats.isError && !stats.data ? (
                    <p className="text-destructive">{t('error')}</p>
                ) : (
                    <dl className="grid grid-cols-2 gap-4">
                        <div>
                            <dt className="text-sm text-muted-foreground">{t('total')}</dt>
                            <dd
                                className="text-2xl font-semibold tabular-nums"
                                data-testid="stats-total"
                            >
                                {stats.data ? format.number(stats.data.total) : <Skeleton className="h-8 w-12" />}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">{t('lastHour')}</dt>
                            <dd className="text-2xl font-semibold tabular-nums">
                                {stats.data ? (
                                    format.number(stats.data.createdLastHour)
                                ) : (
                                    <Skeleton className="h-8 w-12" />
                                )}
                            </dd>
                        </div>
                    </dl>
                )}
            </CardContent>
        </Card>
    )
}
