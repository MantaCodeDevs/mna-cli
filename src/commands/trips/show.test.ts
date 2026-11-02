import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { tripsShowCommand } from './show'

type RunFn = (ctx: { args: Record<string, unknown> }) => Promise<void>
const run = (args: Record<string, unknown>) => (tripsShowCommand.run as unknown as RunFn)({ args })

let originalFetch: typeof fetch
let originalKey: string | undefined

beforeEach(() => {
    originalFetch = global.fetch
    originalKey = process.env.MNA_API_KEY
    process.env.MNA_API_KEY = 'mna_test'
    global.fetch = (async () =>
        Response.json({
            id: 't',
            name: 'Trip',
            status: 'planning',
            variants: [
                {
                    id: 'v',
                    name: 'Family',
                    participants: { adults: 2, children: [{ age: 10 }, { age: 7 }] },
                    destinations: [],
                    eventsToAttend: [],
                },
            ],
        })) as unknown as typeof fetch
})

afterEach(() => {
    global.fetch = originalFetch
    process.env.MNA_API_KEY = originalKey
    if (originalKey === undefined) Reflect.deleteProperty(process.env, 'MNA_API_KEY')
})

describe('trips show', () => {
    test("prints each variant's party", async () => {
        const stdout = spyOn(process.stdout, 'write').mockImplementation(() => true)

        await run({ tripId: 't', 'all-options': false, json: false })

        const printed = stdout.mock.calls.map(([chunk]) => String(chunk)).join('')
        stdout.mockRestore()
        expect(printed).toContain('Party')
        expect(printed).toContain('2 adults, 2 children (10, 7)')
    })
})
