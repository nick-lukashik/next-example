import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

async function load(env: Record<string, string>) {
    vi.resetModules()
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    return (await import('./server')).serverEnv
}

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('serverEnv', () => {
    it('falls back to local defaults for unset or blank values', async () => {
        const env = await load({
            API_URL: '',
            SITE_URL: ' ',
            APP_VERSION: '',
            LOG_LEVEL: '',
            API_REQUEST_TIMEOUT_MS: '',
            API_BODY_TIMEOUT_MS: '',
            ROBOTS: '',
        })
        expect(env).toMatchObject({
            API_URL: 'http://localhost:4000',
            SITE_URL: 'http://localhost:3000',
            APP_VERSION: 'dev',
            LOG_LEVEL: 'info',
            // Service contract time budgets.
            API_REQUEST_TIMEOUT_MS: 10_000,
            API_BODY_TIMEOUT_MS: 10_000,
            ROBOTS: 'index',
        })
    })

    it('reads ROBOTS at runtime', async () => {
        const env = await load({
            ROBOTS: 'noindex',
        })
        expect(env.ROBOTS).toBe('noindex')
    })

    it('drops trailing slashes and coerces numbers', async () => {
        const env = await load({
            API_URL: 'https://api.example.com/',
            SITE_URL: 'https://example.com//',
            API_REQUEST_TIMEOUT_MS: '2500',
        })
        expect(env.API_URL).toBe('https://api.example.com')
        expect(env.SITE_URL).toBe('https://example.com')
        expect(env.API_REQUEST_TIMEOUT_MS).toBe(2500)
    })

    it('names every invalid variable', async () => {
        await expect(
            load({
                API_URL: 'not a url',
                LOG_LEVEL: 'loud',
                ROBOTS: 'maybe',
            }),
        ).rejects.toThrow(/Invalid server environment[\s\S]*API_URL[\s\S]*LOG_LEVEL[\s\S]*ROBOTS/)
    })
})
