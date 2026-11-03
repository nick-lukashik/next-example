// In-memory implementation of the notes contract (./openapi.json), for e2e
// tests and for working on the frontend without a backend:
//   pnpm mock:api                 # http://localhost:4000
//   PORT=4010 pnpm mock:api
// Test hooks: a title starting with "!fail" answers 500, "!slow" never
// answers (until the caller gives up); POST /__mock/reset restores the seed
// and clears the request log; GET /__mock/requests lists the /api requests
// that arrived since (method, path, headers, body size, aborted). Runs on
// Node's built-in TypeScript support.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

type Note = {
    id: string
    title: string
    body: string
    createdAt: string
}
type Issue = {
    path: string
    message: string
}
/** One /api request as it arrived, for tests of what the web's proxy forwards. */
type Received = {
    method: string
    path: string
    headers: IncomingMessage['headers']
    bodyBytes?: number
    aborted: boolean
}

const port = Number(process.env.PORT ?? 4000)
const createDelayMs = Number(process.env.MOCK_DELAY_MS ?? 400)
const statsDelayMs = Number(process.env.MOCK_STATS_DELAY_MS ?? 2000)
const openapi = readFileSync(new URL('./openapi.json', import.meta.url), 'utf8')

let notes: Note[] = []
let stats = {
    total: 0,
    createdLastHour: 0,
}
let generation = 0
let received: Received[] = []

function seed() {
    generation += 1
    received = []
    const start = Date.parse('2026-10-01T09:00:00.000Z')
    notes = Array.from(
        {
            length: 45,
        },
        (_, index) => {
            const n = 45 - index
            return {
                id: `note-${String(n).padStart(3, '0')}`,
                title: `Seed note ${n}`,
                body: n % 3 === 0 ? '' : `Body of seed note ${n}. Written by the mock API.`,
                createdAt: new Date(start + n * 3_600_000).toISOString(),
            }
        },
    )
    stats = {
        total: notes.length,
        createdLastHour: 0,
    }
}

function recount() {
    const hourAgo = Date.now() - 3_600_000
    stats = {
        total: notes.length,
        createdLastHour: notes.filter(note => Date.parse(note.createdAt) > hourAgo).length,
    }
}

const encodeCursor = (id: string) =>
    Buffer.from(
        JSON.stringify({
            after: id,
        }),
    ).toString('base64url')
function decodeCursor(cursor: string): string | undefined {
    try {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
        return typeof value?.after === 'string' ? value.after : undefined
    } catch {
        return undefined
    }
}

function send(res: ServerResponse, status: number, body: unknown, requestId: string) {
    res.writeHead(status, {
        'content-type': 'application/json',
        'x-request-id': requestId,
    })
    res.end(body === undefined ? '' : JSON.stringify(body))
}

function fail(
    res: ServerResponse,
    status: number,
    code: string,
    message: string,
    requestId: string,
    details?: Issue[],
) {
    send(
        res,
        status,
        {
            code,
            message,
            ...(details
                ? {
                      details,
                  }
                : {}),
            requestId,
        },
        requestId,
    )
}

async function readJson(req: IncomingMessage, record?: Received): Promise<unknown> {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const raw = Buffer.concat(chunks)
    if (record) record.bodyBytes = raw.byteLength
    const text = raw.toString('utf8')
    return text ? JSON.parse(text) : undefined
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://mock')
    const incoming = req.headers['x-request-id']
    const requestId = typeof incoming === 'string' && incoming ? incoming : randomUUID()
    const method = req.method ?? 'GET'
    const path = url.pathname

    if (method === 'GET' && (path === '/health/ready' || path === '/health/live')) {
        return send(
            res,
            200,
            {
                status: 'ok',
            },
            requestId,
        )
    }
    if (method === 'GET' && path === '/openapi.json') {
        res.writeHead(200, {
            'content-type': 'application/json',
        })
        return res.end(openapi)
    }
    if (method === 'POST' && path === '/__mock/reset') {
        seed()
        return send(res, 204, undefined, requestId)
    }
    if (method === 'GET' && path === '/__mock/requests') {
        return send(res, 200, received, requestId)
    }

    const record: Received = {
        method,
        path,
        headers: req.headers,
        aborted: false,
    }
    received.push(record)
    if (received.length > 100) received.shift()
    res.on('close', () => {
        if (!res.writableFinished) record.aborted = true
    })

    if (method === 'GET' && path === '/api/v1/notes') {
        const limit = Number(url.searchParams.get('limit') ?? 20)
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return fail(res, 400, 'VALIDATION_FAILED', 'Invalid query', requestId, [
                {
                    path: 'limit',
                    message: 'limit must be an integer from 1 to 100',
                },
            ])
        }
        const cursor = url.searchParams.get('cursor')
        let start = 0
        if (cursor) {
            const after = decodeCursor(cursor)
            const index = notes.findIndex(note => note.id === after)
            if (index < 0) {
                return fail(res, 400, 'VALIDATION_FAILED', 'Invalid cursor', requestId, [
                    {
                        path: 'cursor',
                        message: 'cursor is not valid',
                    },
                ])
            }
            start = index + 1
        }
        const items = notes.slice(start, start + limit)
        const last = items.at(-1)
        const nextCursor = last && start + limit < notes.length ? encodeCursor(last.id) : null
        return send(
            res,
            200,
            {
                items,
                nextCursor,
            },
            requestId,
        )
    }

    if (method === 'GET' && path === '/api/v1/notes/stats') {
        return send(res, 200, stats, requestId)
    }

    const detail = path.match(/^\/api\/v1\/notes\/([^/]+)$/)
    if (method === 'GET' && detail) {
        const id = decodeURIComponent(detail[1] ?? '')
        const note = notes.find(item => item.id === id)
        if (!note) return fail(res, 404, 'NOT_FOUND', `Note ${id} not found`, requestId)
        return send(res, 200, note, requestId)
    }

    if (method === 'POST' && path === '/api/v1/notes') {
        let input: unknown
        try {
            input = await readJson(req, record)
        } catch {
            return fail(res, 400, 'VALIDATION_FAILED', 'Body is not JSON', requestId, [])
        }
        const { title, body = '' } = (input ?? {}) as {
            title?: unknown
            body?: unknown
        }
        const issues: Issue[] = []
        if (typeof title !== 'string' || title.trim().length < 1 || title.length > 200) {
            issues.push({
                path: 'title',
                message: 'title must be 1 to 200 characters',
            })
        }
        if (typeof body !== 'string' || body.length > 5000) {
            issues.push({
                path: 'body',
                message: 'body must be at most 5000 characters',
            })
        }
        if (typeof title === 'string' && title.startsWith('!slow')) {
            // Holds the request until the caller gives up (at most a minute).
            await Promise.race([
                new Promise(resolve => res.once('close', resolve)),
                sleep(60_000),
            ])
            if (!res.destroyed) fail(res, 500, 'INTERNAL', 'Mock gave up waiting', requestId)
            return
        }
        await sleep(createDelayMs)
        if (issues.length > 0) {
            return fail(res, 400, 'VALIDATION_FAILED', 'Validation failed', requestId, issues)
        }
        if ((title as string).startsWith('!fail')) {
            return fail(res, 500, 'INTERNAL', 'Mock failure', requestId)
        }
        const note: Note = {
            id: randomUUID(),
            title: (title as string).trim(),
            body: body as string,
            createdAt: new Date().toISOString(),
        }
        notes = [
            note,
            ...notes,
        ]
        // Stats are recounted asynchronously, like the real backend's worker.
        const seen = generation
        setTimeout(() => {
            if (seen === generation) recount()
        }, statsDelayMs)
        return send(res, 201, note, requestId)
    }

    return fail(res, 404, 'NOT_FOUND', `No route ${method} ${path}`, requestId)
}

seed()
createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
        console.error(error)
        if (!res.headersSent) fail(res, 500, 'INTERNAL', 'Mock crashed', randomUUID())
    })
}).listen(port, () => {
    console.log(`mock API on http://localhost:${port}`)
})
