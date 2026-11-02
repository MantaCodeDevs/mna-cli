import { describe, expect, test } from 'bun:test'
import { formatParty } from './party'

describe('formatParty', () => {
    test('shows adults alone when there are no children', () => {
        expect(formatParty({ adults: 1, children: [] })).toBe('1 adult')
        expect(formatParty({ adults: 2 })).toBe('2 adults')
    })

    test('lists every child age in the stored order', () => {
        expect(formatParty({ adults: 2, children: [{ age: 10 }, { age: 7 }] })).toBe('2 adults, 2 children (10, 7)')
    })

    test('keeps an infant age of 0 and uses the singular for one child', () => {
        expect(formatParty({ adults: 1, children: [{ age: 0 }] })).toBe('1 adult, 1 child (0)')
    })

    test('renders nothing when the party is absent', () => {
        expect(formatParty(undefined)).toBe('')
    })
})
