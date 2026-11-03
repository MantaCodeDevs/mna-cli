import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { optionsEditCommand } from './edit'

type RunFn = (ctx: { args: Record<string, unknown> }) => Promise<void>
const run = (args: Record<string, unknown>) =>
    (optionsEditCommand.run as unknown as RunFn)({ args })

let originalFetch: typeof fetch
let originalKey: string | undefined
let captured: { method: string; url: string; body: unknown } | undefined

beforeEach(() => {
    originalFetch = global.fetch
    originalKey = process.env.MNA_API_KEY
    process.env.MNA_API_KEY = 'mna_test'
    captured = undefined
    global.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
        const req = input instanceof Request ? input : new Request(String(input), init)
        const text = await req.text()
        captured = { method: req.method, url: req.url, body: text ? JSON.parse(text) : undefined }
        return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
})

afterEach(() => {
    global.fetch = originalFetch
    process.env.MNA_API_KEY = originalKey
    if (originalKey === undefined) Reflect.deleteProperty(process.env, 'MNA_API_KEY')
})

describe('options edit — free-cancellation flag', () => {
    test('builds the body from --free-cancellation-until alone (no --from-json needed)', async () => {
        await run({
            tripId: 't',
            variantId: 'v',
            destinationKey: 'd',
            kind: 'accommodation',
            optionKey: 'o1',
            'free-cancellation-until': '2026-07-02',
            json: false,
        })

        expect(captured?.method).toBe('PATCH')
        expect(captured?.url).toContain('/options/accommodation/o1')
        expect(captured?.body).toEqual({ freeCancellationUntil: '2026-07-02T00:00:00.000Z' })
    })
})

describe('options edit — stay details flags', () => {
    test('builds the body from --details and --photos alone', async () => {
        await run({
            tripId: 't',
            variantId: 'v',
            destinationKey: 'd',
            kind: 'accommodation',
            optionKey: 'o1',
            details: '{"parking":"Garage","noise":null}',
            photos: '[{"url":"https://example.com/a.jpg"}]',
            json: false,
        })

        expect(captured?.method).toBe('PATCH')
        expect(captured?.url).toContain('/options/accommodation/o1')
        expect(captured?.body).toEqual({
            stayDetails: { parking: 'Garage', noise: null },
            photos: [{ url: 'https://example.com/a.jpg' }],
        })
    })
})
