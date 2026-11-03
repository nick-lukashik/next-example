import 'server-only'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isApiError } from '@/lib/api/errors'
import { notesApi } from '@/lib/api/notes'
import { serverApi } from '@/lib/api/server'

/**
 * One fetch per request for generateMetadata and the page (React cache).
 * The API's 404 becomes the app's not-found page; other errors go to error.tsx.
 */
export const loadNote = cache(async (id: string) => {
    try {
        return await notesApi.get(await serverApi(), id)
    } catch (error) {
        if (isApiError(error) && error.code === 'NOT_FOUND') notFound()
        throw error
    }
})
