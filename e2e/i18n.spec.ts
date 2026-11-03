import { en, expect, ru, test } from './fixtures'

test.describe('language', () => {
    test('?lang=ru renders Russian and rewrites the cookie', async ({ page, context }) => {
        await page.goto('/notes?lang=ru')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page).toHaveTitle(`${ru.notes.meta.title} · ${ru.meta.siteName}`)
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: ru.notes.heading,
            }),
        ).toBeVisible()

        const cookies = await context.cookies()
        expect(cookies.find(cookie => cookie.name === 'locale')?.value).toBe('ru')

        // Without the parameter the cookie keeps the choice.
        await page.goto('/')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

        // And ?lang=en switches back.
        await page.goto('/?lang=en')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await page.goto('/notes')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })

    test('the language switch keeps the page', async ({ page }) => {
        await page.goto('/notes?lang=en')
        await page
            .getByRole('navigation', {
                name: en.nav.language,
            })
            .getByRole('link', {
                name: ru.meta.languageName,
            })
            .click()
        await expect(page).toHaveURL(/\/notes\?lang=ru$/)
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(
            page.getByRole('button', {
                name: ru.notes.form.submit,
            }),
        ).toBeVisible()
    })
})

test.describe('first visit with a Russian browser', () => {
    test.use({
        locale: 'ru-RU',
    })

    test('falls back to Accept-Language', async ({ page }) => {
        await page.goto('/')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page).toHaveTitle(ru.home.meta.title)
    })
})
