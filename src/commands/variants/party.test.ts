import { describe, expect, test } from 'bun:test'
import { mergeParticipants, parsePartyChange, participantsForNewVariant } from './party'

const ADD_POSITIONALS = 1

const parse = (args: Record<string, unknown>) => parsePartyChange(args, ADD_POSITIONALS)

describe('parsePartyChange', () => {
    test('returns undefined when no party flag is given', () => {
        expect(parse({ name: 'Beach option' })).toBeUndefined()
    })

    test('parses adults alone without inventing children', () => {
        expect(parse({ adults: '2' })).toEqual({ adults: 2, children: undefined })
    })

    test('parses comma-separated ages in order, tolerating spaces', () => {
        expect(parse({ 'child-ages': '10, 7' })?.children).toEqual([{ age: 10 }, { age: 7 }])
    })

    test('parses a repeated flag, which citty hands over as an array', () => {
        expect(parse({ 'child-ages': ['10', '7,3'] })?.children).toEqual([{ age: 10 }, { age: 7 }, { age: 3 }])
    })

    test('accepts the bounds of the age range', () => {
        expect(parse({ 'child-ages': '0,17' })?.children).toEqual([{ age: 0 }, { age: 17 }])
    })

    test('--no-children is an explicit empty list, distinct from not saying', () => {
        expect(parse({ children: false })).toEqual({ adults: undefined, children: [] })
    })

    test.each(['0', '-1', '1.5', 'two', '', ' ', '1e1', '0x2', '99999999999999999999'])(
        'rejects adult count %p',
        (adults) => {
            expect(() => parse({ adults })).toThrow(/Invalid adult count for --adults/)
        },
    )

    test('rejects --adults given twice rather than picking one', () => {
        expect(() => parse({ adults: ['2', '3'] })).toThrow(/more than once/)
    })

    test.each(['18', '-1', '7.5', 'seven', '10,,7', '10,'])('rejects child ages %p', (ages) => {
        expect(() => parse({ 'child-ages': ages })).toThrow(/Invalid child age for --child-ages/)
    })

    test('an empty --child-ages is an error, so an unset shell variable cannot wipe children', () => {
        expect(() => parse({ 'child-ages': '' })).toThrow(/--no-children/)
    })

    test('rejects --child-ages together with --no-children', () => {
        expect(() => parse({ 'child-ages': '10', children: false })).toThrow(/contradict/)
    })

    test('rejects a bare --children, which carries no ages', () => {
        expect(() => parse({ children: true })).toThrow(/--child-ages/)
    })

    test('rejects space-separated ages instead of dropping all but the first', () => {
        expect(() => parse({ _: ['trip', '7'], 'child-ages': '10' })).toThrow(/Unexpected argument: 7/)
    })

    test('counts only the positionals beyond the ones the command declares', () => {
        expect(parsePartyChange({ _: ['trip', 'variant'], 'child-ages': '10' }, 2)?.children).toEqual([{ age: 10 }])
    })
})

describe('participantsForNewVariant', () => {
    test('leaves the API default alone when no party flag was given', () => {
        expect(participantsForNewVariant(undefined)).toBeUndefined()
    })

    test('sends an explicit empty children list for adults only', () => {
        expect(participantsForNewVariant({ adults: 2 })).toEqual({ adults: 2, children: [] })
    })

    test('refuses children without adults rather than letting them default to one', () => {
        expect(() => participantsForNewVariant({ children: [{ age: 10 }] })).toThrow(/--adults is required/)
        expect(() => participantsForNewVariant({ children: [] })).toThrow(/--adults is required/)
    })
})

describe('mergeParticipants', () => {
    const current = { adults: 2, children: [{ age: 10 }, { age: 7 }], numberOfRooms: 2 }

    test('changing adults keeps the children and rooms', () => {
        expect(mergeParticipants(current, { adults: 3 })).toEqual({ ...current, adults: 3 })
    })

    test('changing children keeps the adults and rooms', () => {
        expect(mergeParticipants(current, { children: [{ age: 4 }] })).toEqual({
            adults: 2,
            children: [{ age: 4 }],
            numberOfRooms: 2,
        })
    })

    test('an empty children list clears them', () => {
        expect(mergeParticipants(current, { children: [] }).children).toEqual([])
    })

    test('changing everything the flags cover still keeps rooms', () => {
        expect(mergeParticipants(current, { adults: 1, children: [] }).numberOfRooms).toBe(2)
    })

    test('strips the Mongo ids a read carries, which writes reject', () => {
        const stored = { adults: 2, children: [{ age: 10, _id: 'c' }], _id: 'p' }

        expect(JSON.parse(JSON.stringify(mergeParticipants(stored, { adults: 3 })))).toEqual({
            adults: 3,
            children: [{ age: 10 }],
        })
    })
})
