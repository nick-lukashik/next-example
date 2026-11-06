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
        expect(cookies.find(cookie => cookie.name === 'nl_locale')?.value).toBe('ru')

        // Without the parameter the cookie keeps the choice.
        await page.goto('/')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

        // And ?lang=en switches back.
        await page.goto('/?lang=en')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await page.goto('/notes')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })

    test('the language switch keeps the page and sets only the cookie', async ({ page, context }) => {
        await page.goto('/notes?lang=en')
        await page
            .getByRole('navigation', {
                name: en.nav.language,
            })
            .getByRole('link', {
                name: ru.meta.languageName,
            })
            .click()
        // Only the cookie changes: the address gets no ?lang=.
        await expect(page).toHaveURL(/\/notes$/)
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(
            page.getByRole('button', {
                name: ru.notes.form.submit,
            }),
        ).toBeVisible()
        const cookies = await context.cookies()
        expect(cookies.find(cookie => cookie.name === 'nl_locale')?.value).toBe('ru')
    })
})

test.describe('without JavaScript', () => {
    test.use({
        javaScriptEnabled: false,
    })

    test('the language switch falls back to ?lang=', async ({ page }) => {
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
    })
})

test.describe('first visit with a Russian browser', () => {
    test.use({
        locale: 'ru-RU',
    })

    test('is still in English', async ({ page }) => {
        await page.goto('/')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await expect(page).toHaveTitle(en.home.meta.title)
    })
})
