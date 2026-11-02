import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test'
import { variantsAddCommand } from './add'
import { variantsEditCommand } from './edit'

type RunFn = (ctx: { args: Record<string, unknown> }) => Promise<void>
const runAdd = (args: Record<string, unknown>) =>
    (variantsAddCommand.run as unknown as RunFn)({ args })
const runEdit = (args: Record<string, unknown>) =>
    (variantsEditCommand.run as unknown as RunFn)({ args })

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

describe('variants add — date flags', () => {
    test('sends exact dates alongside the name', async () => {
        await runAdd({
            tripId: 't',
            name: 'Beach option',
            'start-date': '2026-09-01',
            'end-date': '2026-09-08',
            json: false,
        })

        expect(captured?.method).toBe('POST')
        expect(captured?.body).toEqual({
            name: 'Beach option',
            dates: {
                startDate: '2026-09-01T00:00:00.000Z',
                endDate: '2026-09-08T00:00:00.000Z',
            },
        })
    })

    test('sends flexi dates with numeric night bounds', async () => {
        await runAdd({
            tripId: 't',
            name: 'Flexible option',
            'depart-not-before': '2026-09-01',
            'depart-not-after': '2026-09-03',
            'return-not-before': '2026-09-10',
            'return-not-after': '2026-09-12',
            'min-nights': '7',
            'max-nights': '10',
            json: false,
        })

        expect(captured?.body).toEqual({
            name: 'Flexible option',
            dates: {
                departLeavingNotBeforeDate: '2026-09-01T00:00:00.000Z',
                departArrivingNotAfterDate: '2026-09-03T00:00:00.000Z',
                returnLeavingNotBeforeDate: '2026-09-10T00:00:00.000Z',
                returnArrivingNotAfterDate: '2026-09-12T00:00:00.000Z',
                minNights: 7,
                maxNights: 10,
            },
        })
    })
})

describe('variants edit — date flags', () => {
    test('omits dates when no date flag is given', async () => {
        await runEdit({ tripId: 't', variantId: 'v', name: 'Renamed', json: false })

        expect(captured?.method).toBe('PATCH')
        expect(captured?.body).toEqual({ name: 'Renamed' })
    })

    test('sends a complete dates object when the flags are given', async () => {
        await runEdit({
            tripId: 't',
            variantId: 'v',
            'start-date': '2026-09-02',
            'end-date': '2026-09-09',
            json: false,
        })

        expect(captured?.body).toEqual({
            dates: {
                startDate: '2026-09-02T00:00:00.000Z',
                endDate: '2026-09-09T00:00:00.000Z',
            },
        })
    })
})

describe('variants add — party flags', () => {
    const exactDates = { 'start-date': '2026-09-01', 'end-date': '2026-09-08' }

    test('sends adults and children ages', async () => {
        await runAdd({ tripId: 't', name: 'Family', ...exactDates, adults: '2', 'child-ages': '10,7', json: false })

        expect(captured?.body).toMatchObject({
            participants: { adults: 2, children: [{ age: 10 }, { age: 7 }] },
        })
    })

    test('sends adults alone with an explicit empty children list', async () => {
        await runAdd({ tripId: 't', name: 'Couple', ...exactDates, adults: '2', json: false })

        expect(captured?.body).toMatchObject({ participants: { adults: 2, children: [] } })
    })

    test('omits participants when no party flag is given', async () => {
        await runAdd({ tripId: 't', name: 'Solo', ...exactDates, json: false })

        expect(captured?.body).not.toHaveProperty('participants')
    })
})

describe('variants edit — party flags', () => {
    const SELECTED = 'selected-variant'
    const UNSELECTED = 'other-variant'
    const storedParty = {
        adults: 2,
        children: [{ age: 10, _id: 'child-id' }],
        numberOfRooms: 2,
        _id: 'party-id',
    }

    let requests: { method: string; url: string; body: unknown }[]

    const patchBodies = () => requests.filter((request) => request.method === 'PATCH').map((request) => request.body)

    // Mirrors the real read: without includeAllOptions only the selected variant comes back.
    beforeEach(() => {
        requests = []
        global.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
            const req = input instanceof Request ? input : new Request(String(input), init)
            const text = await req.text()
            requests.push({ method: req.method, url: req.url, body: text ? JSON.parse(text) : undefined })
            if (req.method !== 'GET') return new Response(null, { status: 200 })

            const variants = [{ id: SELECTED, name: 'Selected', participants: { adults: 1, children: [] } }]
            if (req.url.includes('includeAllOptions=true')) {
                variants.push({ id: UNSELECTED, name: 'Other', participants: storedParty as never })
            }
            return Response.json({ id: 't', name: 'Trip', variants })
        }) as unknown as typeof fetch
    })

    test('--adults keeps the stored children and rooms, without their ids', async () => {
        await runEdit({ tripId: 't', variantId: UNSELECTED, adults: '3', json: false })

        expect(patchBodies()).toEqual([{ participants: { adults: 3, children: [{ age: 10 }], numberOfRooms: 2 } }])
    })

    test('--child-ages keeps the stored adults and rooms', async () => {
        await runEdit({ tripId: 't', variantId: UNSELECTED, 'child-ages': '4,5', json: false })

        expect(patchBodies()).toEqual([
            { participants: { adults: 2, children: [{ age: 4 }, { age: 5 }], numberOfRooms: 2 } },
        ])
    })

    test('giving both flags still keeps the stored rooms', async () => {
        await runEdit({ tripId: 't', variantId: UNSELECTED, adults: '1', 'child-ages': '4', json: false })

        expect(patchBodies()).toEqual([{ participants: { adults: 1, children: [{ age: 4 }], numberOfRooms: 2 } }])
    })

    test('--no-children clears the children only', async () => {
        await runEdit({ tripId: 't', variantId: UNSELECTED, children: false, json: false })

        expect(patchBodies()).toEqual([{ participants: { adults: 2, children: [], numberOfRooms: 2 } }])
    })

    test('combines with other fields in one write', async () => {
        await runEdit({ tripId: 't', variantId: UNSELECTED, name: 'Renamed', adults: '3', json: false })

        expect(patchBodies()).toEqual([
            { name: 'Renamed', participants: { adults: 3, children: [{ age: 10 }], numberOfRooms: 2 } },
        ])
    })

    test('neither flag reads nothing and leaves participants out of the write', async () => {
        await runEdit({ tripId: 't', variantId: UNSELECTED, name: 'Renamed', json: false })

        expect(requests.map((request) => request.method)).toEqual(['PATCH'])
        expect(patchBodies()).toEqual([{ name: 'Renamed' }])
    })

    test('an unknown variant fails without writing', async () => {
        const stderr = spyOn(process.stderr, 'write').mockImplementation(() => true)
        const exit = spyOn(process, 'exit').mockImplementation(((code: number) => {
            throw new Error(`exit ${code}`)
        }) as never)

        await expect(runEdit({ tripId: 't', variantId: 'missing', adults: '3', json: false })).rejects.toThrow('exit 1')

        const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join('')
        stderr.mockRestore()
        exit.mockRestore()
        expect(printed).toContain('Variant missing not found on trip t')
        expect(patchBodies()).toEqual([])
    })
})
