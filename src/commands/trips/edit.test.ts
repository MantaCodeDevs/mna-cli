import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { tripsEditCommand } from './edit'

type RunFn = (ctx: { args: Record<string, unknown> }) => Promise<void>
const run = (args: Record<string, unknown>) =>
    (tripsEditCommand.run as unknown as RunFn)({ args })

let originalFetch: typeof fetch
let originalKey: string | undefined
let captured: { method: string; body: unknown } | undefined

beforeEach(() => {
    originalFetch = global.fetch
    originalKey = process.env.MNA_API_KEY
    process.env.MNA_API_KEY = 'mna_test'
    captured = undefined
    global.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
        const req = input instanceof Request ? input : new Request(String(input), init)
        const text = await req.text()
        captured = { method: req.method, body: text ? JSON.parse(text) : undefined }
        return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
})

afterEach(() => {
    global.fetch = originalFetch
    process.env.MNA_API_KEY = originalKey
    if (originalKey === undefined) Reflect.deleteProperty(process.env, 'MNA_API_KEY')
})

describe('trips edit — budget flag', () => {
    test('sends the parsed budget', async () => {
        await run({
            tripId: 't',
            budget: '{"amount":4000,"currency":"EUR","appliesTo":"stay"}',
            json: false,
        })

        expect(captured?.method).toBe('PATCH')
        expect(captured?.body).toEqual({
            budget: { amount: 4000, currency: 'EUR', appliesTo: 'stay' },
        })
    })

    test('--budget null clears it', async () => {
        await run({ tripId: 't', budget: 'null', json: false })

        expect(captured?.body).toEqual({ budget: null })
    })
})
