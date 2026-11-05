import AxeBuilder from '@axe-core/playwright'
import { expect, ru, test } from './fixtures'

const WCAG = [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
]
const pages = [
    '/',
    '/notes',
    '/notes/note-010',
    '/nowhere',
]

test.describe('accessibility', () => {
    for (const path of pages) {
        test(`${path} has no axe violations`, async ({ page }) => {
            await page.goto(path)
            await page.locator('main').waitFor()
            const results = await new AxeBuilder({
                page,
            })
                .withTags(WCAG)
                .analyze()
            expect(results.violations).toEqual([])
        })
    }

    test('form errors have no axe violations', async ({ page }) => {
        await page.goto('/notes?lang=ru')
        await page
            .getByRole('button', {
                name: ru.notes.form.submit,
            })
            .click()
        await expect(page.getByLabel(ru.notes.form.titleLabel)).toHaveAttribute('aria-invalid', 'true')
        const results = await new AxeBuilder({
            page,
        })
            .withTags(WCAG)
            .analyze()
        expect(results.violations).toEqual([])
    })

    test('toasts have no axe violations', async ({ page }) => {
        await page.goto('/notes?lang=ru')
        await page.getByLabel(ru.notes.form.titleLabel).fill('!fail axe')
        await page
            .getByRole('button', {
                name: ru.notes.form.submit,
            })
            .click()
        const toasts = page.getByRole('region', {
            name: ru.toast.region,
        })
        await expect(toasts.getByText(ru.notes.form.failed)).toBeVisible()
        // Settled: axe reads a colour mixed with the page while the toast fades in.
        await expect(page.locator('[data-sonner-toast]')).toHaveCSS('opacity', '1')
        const results = await new AxeBuilder({
            page,
        })
            .withTags(WCAG)
            .analyze()
        expect(results.violations).toEqual([])
    })
})
