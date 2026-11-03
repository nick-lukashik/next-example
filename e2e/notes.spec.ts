import { type Locator, type Page } from '@playwright/test'
import { en, expect, ru, test, uniqueTitle } from './fixtures'

// Runs in two projects: chromium (the mock API, reset to its 45 seed notes
// before each test) and real-api (E2E_API_URL, whatever data is there). So
// the expectations come from the API itself or from notes the test creates.

const { list: listText, form } = en.notes
const PAGE_SIZE = 20
const toasts = (page: Page) =>
    page.getByRole('region', {
        name: en.toast.region,
    })
const numberIn = async (locator: Locator) => Number((await locator.textContent())?.replace(/\D/g, ''))

/**
 * Holds the browser's create requests, so the optimistic state is visible
 * long enough to check. The mock already waits 700 ms (MOCK_DELAY_MS); a
 * real API answers at once.
 */
async function holdCreates(page: Page, ms: number) {
    await page.route('**/api/v1/notes', async route => {
        if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, ms))
        await route.continue()
    })
}

test.describe('notes', () => {
    test('renders the first page on the server and loads more with the cursor', async ({ page, request, backend }) => {
        // Three pages at least: 20 + 20 + the rest.
        await backend.ensureNotes(2 * PAGE_SIZE + 5)
        const notes = await backend.allNotes()
        const newest = notes[0]
        if (!newest) throw new Error('no notes')
        const newestHref = `/notes/${encodeURIComponent(newest.id)}`

        const html = await (await request.get('/notes?lang=en')).text()
        expect(html).toContain(`href="${newestHref}"`)

        await page.goto('/notes?lang=en')
        const list = page.getByRole('list', {
            name: listText.title,
        })
        const items = list.getByRole('listitem')
        await expect(items).toHaveCount(PAGE_SIZE)
        // Newest first.
        await expect(items.first().getByRole('link')).toHaveAttribute('href', newestHref)

        const loadMore = page.getByRole('button', {
            name: listText.loadMore,
        })
        for (let shown = PAGE_SIZE; shown < notes.length; ) {
            await loadMore.click()
            shown = Math.min(shown + PAGE_SIZE, notes.length)
            await expect(items).toHaveCount(shown)
        }
        await expect(page.getByText(listText.end)).toBeVisible()
        await expect(loadMore).toHaveCount(0)
    })

    test("creates a note optimistically, then shows the server's version and new stats", async ({ page, backend }) => {
        if (backend.kind === 'real') await holdCreates(page, 700)
        await page.goto('/notes?lang=en')
        const total = page.getByTestId('stats-total')
        await expect(total).toHaveText(/\d/)
        if (backend.kind === 'mock') await expect(total).toHaveText('45')
        const before = await numberIn(total)

        const title = uniqueTitle('Optimistic')
        await page.getByLabel(form.titleLabel).fill(title)
        await page.getByLabel(form.bodyLabel).fill('Written by Playwright.')
        await page
            .getByRole('button', {
                name: form.submit,
            })
            .click()

        // Before the API answers (the mock waits 700 ms): at the top, not yet a link.
        const list = page.getByRole('list', {
            name: listText.title,
        })
        const first = list.getByRole('listitem').first()
        await expect(first).toContainText(title)
        await expect(first).toContainText(listText.saving)
        await expect(first.getByRole('link')).toHaveCount(0)

        // Confirmed: a link to the note, a toast, the form cleared.
        await expect(
            first.getByRole('link', {
                name: title,
            }),
        ).toBeVisible()
        await expect(toasts(page).getByText(form.created)).toBeVisible()
        // Sonner's runtime stylesheet passed the CSP (allowed by hash in csp.ts).
        await expect(toasts(page).getByRole('list')).toHaveCSS('position', 'fixed')
        await expect(page.getByLabel(form.titleLabel)).toHaveValue('')

        // The backend recounts asynchronously; the widget polls until it moves.
        await expect
            .poll(() => numberIn(total), {
                timeout: 10_000,
            })
            .toBeGreaterThan(before)

        await first
            .getByRole('link', {
                name: title,
            })
            .click()
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: title,
            }),
        ).toBeVisible()
    })

    test('rolls the optimistic note back when the API fails', async ({ page, backend }) => {
        test.skip(backend.kind === 'real', 'needs the mock API failure hook (a title starting with "!fail")')
        await page.goto('/notes?lang=en')
        const title = uniqueTitle('!fail')
        await page.getByLabel(form.titleLabel).fill(title)
        await page
            .getByRole('button', {
                name: form.submit,
            })
            .click()

        const list = page.getByRole('list', {
            name: listText.title,
        })
        await expect(list.getByText(title)).toBeVisible()
        await expect(toasts(page).getByText(form.failed)).toBeVisible()
        await expect(list.getByText(title)).toHaveCount(0)
        await expect(list.getByRole('listitem')).toHaveCount(PAGE_SIZE)
        // The input is kept for another try.
        await expect(page.getByLabel(form.titleLabel)).toHaveValue(title)
    })

    test("shows the API's validation errors next to the field", async ({ page, backend }) => {
        await backend.ensureNotes(PAGE_SIZE)
        await page.goto('/notes?lang=en')
        await page.getByLabel(form.bodyLabel).fill('No title')
        await page
            .getByRole('button', {
                name: form.submit,
            })
            .click()

        const titleInput = page.getByLabel(form.titleLabel)
        await expect(page.getByText(form.errors.title)).toBeVisible()
        await expect(titleInput).toHaveAttribute('aria-invalid', 'true')
        await expect(titleInput).toBeFocused()
        await expect(titleInput).toHaveAccessibleDescription(new RegExp(form.errors.title))
        await expect(
            page
                .getByRole('list', {
                    name: listText.title,
                })
                .getByRole('listitem'),
        ).toHaveCount(PAGE_SIZE)
    })

    test('note page takes its metadata from the note', async ({ page, backend }) => {
        const note = await backend.create({
            title: uniqueTitle('Metadata'),
            body: 'Written by Playwright for the note page.',
        })
        await page.goto(`/notes/${encodeURIComponent(note.id)}?lang=en`)
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: note.title,
            }),
        ).toBeVisible()
        await expect(page).toHaveTitle(`${note.title} · ${en.meta.siteName}`)
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
            'content',
            'Written by Playwright for the note page.',
        )
        await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
        await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', en.meta.siteName)
    })

    test('a missing note answers 404 with the not-found page', async ({ page }) => {
        const response = await page.goto('/notes/does-not-exist?lang=en')
        expect(response?.status()).toBe(404)
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: en.notFound.title,
            }),
        ).toBeVisible()
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    })

    test("an unknown address answers 404 in the reader's language", async ({ page }) => {
        const response = await page.goto('/nowhere?lang=ru')
        expect(response?.status()).toBe(404)
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: ru.notFound.title,
            }),
        ).toBeVisible()
    })
})
