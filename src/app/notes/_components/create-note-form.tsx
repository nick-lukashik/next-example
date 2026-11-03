'use client'

import { Loader2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateNote } from './use-create-note'

const FIELDS = [
    'title',
    'body',
] as const
type FieldName = (typeof FIELDS)[number]

/** Ids that tie a control to its label, hint and error. */
const ids = (field: FieldName) => ({
    control: `note-${field}`,
    hint: `note-${field}-hint`,
    error: `note-${field}-error`,
})

/**
 * Validation is the server's: VALIDATION_FAILED `details` are shown per
 * field (localized by field name), the first invalid field gets focus.
 * Other failures roll the optimistic note back and raise a toast.
 */
export function CreateNoteForm() {
    const t = useTranslations('notes.form')
    const createNote = useCreateNote()
    const formRef = useRef<HTMLFormElement>(null)

    const error = createNote.error
    const fieldErrors = error?.code === 'VALIDATION_FAILED' ? error.fieldErrors() : {}
    const messageFor = (field: FieldName) => (fieldErrors[field] ? t(`errors.${field}`) : undefined)
    const unknownField = Object.keys(fieldErrors).some(field => !FIELDS.includes(field as FieldName))

    /** Props for the control of `field`: id, invalid state and descriptions. */
    const control = (field: FieldName) => {
        const { control: id, hint, error: errorId } = ids(field)
        const invalid = Boolean(messageFor(field))
        return {
            id,
            name: field,
            'aria-invalid': invalid || undefined,
            'aria-describedby': invalid ? `${hint} ${errorId}` : hint,
        }
    }

    useEffect(() => {
        if (error?.code !== 'VALIDATION_FAILED') return
        const invalid = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")
        invalid?.focus()
    }, [
        error,
    ])

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (createNote.isPending) return
        const form = event.currentTarget
        const data = new FormData(form)
        createNote.mutate(
            {
                title: String(data.get('title') ?? ''),
                body: String(data.get('body') ?? ''),
            },
            {
                onSuccess: () => {
                    form.reset()
                    toast.success(t('created'))
                },
                onError: failure => {
                    if (failure.code === 'VALIDATION_FAILED') return
                    // Errors stay until closed.
                    toast.error(t('failed'), {
                        duration: Number.POSITIVE_INFINITY,
                        description:
                            failure.code === 'RATE_LIMITED'
                                ? t('rateLimited')
                                : t('failedDetails', {
                                      message: failure.message,
                                      requestId: failure.requestId ?? '—',
                                  }),
                    })
                },
            },
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h2 id="create-note-title">{t('title')}</h2>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    ref={formRef}
                    noValidate
                    aria-labelledby="create-note-title"
                    onSubmit={onSubmit}
                    className="grid gap-4"
                >
                    <FieldGroup className="gap-4">
                        {FIELDS.map(field => {
                            const message = messageFor(field)
                            const { hint, error: errorId } = ids(field)
                            return (
                                <Field
                                    key={field}
                                    data-invalid={Boolean(message) || undefined}
                                >
                                    <FieldLabel htmlFor={ids(field).control}>{t(`${field}Label`)}</FieldLabel>
                                    {field === 'title' ? (
                                        <Input
                                            {...control(field)}
                                            maxLength={200}
                                            autoComplete="off"
                                        />
                                    ) : (
                                        <Textarea
                                            {...control(field)}
                                            maxLength={5000}
                                            className="min-h-24"
                                        />
                                    )}
                                    <FieldDescription id={hint}>{t(`${field}Hint`)}</FieldDescription>
                                    {/* Reserves one line so the form does not jump when an error appears. */}
                                    <div className="min-h-5">
                                        {message && <FieldError id={errorId}>{message}</FieldError>}
                                    </div>
                                </Field>
                            )
                        })}
                    </FieldGroup>
                    {unknownField && (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            {t('invalid')}
                        </p>
                    )}
                    {/* Sonner announces toasts politely; failures are announced right away here. */}
                    <p
                        role="alert"
                        className="sr-only"
                    >
                        {error && error.code !== 'VALIDATION_FAILED'
                            ? t(error.code === 'RATE_LIMITED' ? 'rateLimited' : 'failed')
                            : null}
                    </p>
                    {/* Stays focusable while saving (aria-disabled, not disabled). */}
                    <Button
                        type="submit"
                        aria-busy={createNote.isPending || undefined}
                        aria-disabled={createNote.isPending || undefined}
                    >
                        {createNote.isPending && <Loader2Icon className="animate-spin motion-reduce:animate-none" />}
                        {createNote.isPending ? t('submitting') : t('submit')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
