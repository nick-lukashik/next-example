import { type MetadataRoute } from 'next'
import { locales } from '@/i18n/config'
import { notesApi } from '@/lib/api/notes'
import { serverApi } from '@/lib/api/server'
import { type Note } from '@/lib/api/types'
import { serverEnv } from '@/lib/env/server'
import { logger } from '@/lib/logger'
import { languageAlternates, localizedPath } from '@/lib/seo/alternates'

// Per request: SITE_URL is runtime configuration and notes change.
export const dynamic = 'force-dynamic'

type Entry = MetadataRoute.Sitemap[number]

/** One entry per language version, each listing all of them as alternates. */
function localized(path: string, extra: Omit<Entry, 'url'> = {}): MetadataRoute.Sitemap {
    const absolute = (url: string) => `${serverEnv.SITE_URL}${url}`
    const languages = Object.fromEntries(
        Object.entries(languageAlternates(path)).map(([lang, url]) => [
            lang,
            absolute(url),
        ]),
    )
    return locales.map(locale => ({
        ...extra,
        url: absolute(localizedPath(path, locale)),
        alternates: {
            languages,
        },
    }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const pages = [
        ...localized('/', {
            changeFrequency: 'weekly',
            priority: 1,
        }),
        ...localized('/notes', {
            changeFrequency: 'daily',
            priority: 0.8,
        }),
    ]
    // Dynamic entries: the latest notes. A larger set would use generateSitemaps.
    let notes: Note[] = []
    try {
        notes = (
            await notesApi.list(await serverApi(), {
                limit: 100,
            })
        ).items
    } catch (error) {
        logger.warn(
            {
                err: error,
            },
            'sitemap without notes: API unavailable',
        )
    }
    return [
        ...pages,
        ...notes.flatMap(note =>
            localized(`/notes/${encodeURIComponent(note.id)}`, {
                lastModified: note.createdAt,
                changeFrequency: 'monthly',
                priority: 0.5,
            }),
        ),
    ]
}
