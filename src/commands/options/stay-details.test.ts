import { describe, expect, test } from 'bun:test'
import { applyStayFlags } from './stay-details'

describe('applyStayFlags', () => {
    test('leaves the body alone without the flags', () => {
        const body = { name: 'Villa' }
        applyStayFlags(body, {}, 'transport')
        expect(body).toEqual({ name: 'Villa' })
    })

    test('sets stayDetails and photos', () => {
        const body: Record<string, unknown> = {}
        applyStayFlags(
            body,
            {
                details: '{"highlight":"Ski to the door","kitchen":"private"}',
                photos: '[{"url":"https://example.com/a.jpg","credit":"Anna"}]',
            },
            'accommodation',
        )
        expect(body).toEqual({
            stayDetails: { highlight: 'Ski to the door', kitchen: 'private' },
            photos: [{ url: 'https://example.com/a.jpg', credit: 'Anna' }],
        })
    })

    test('a flag wins over the same field from the JSON file', () => {
        const body: Record<string, unknown> = { stayDetails: { noise: 'Bar nearby' } }
        applyStayFlags(body, { details: '{"parking":"Garage"}' }, 'accommodation')
        expect(body.stayDetails).toEqual({ parking: 'Garage' })
    })

    test('passes null through, which clears the field', () => {
        const body: Record<string, unknown> = {}
        applyStayFlags(body, { details: 'null', photos: 'null' }, 'accommodation')
        expect(body).toEqual({ stayDetails: null, photos: null })
    })

    test.each(['transport', 'getting-around'])('rejects the %s kind', (kind) => {
        expect(() => applyStayFlags({}, { details: '{}' }, kind)).toThrow('only valid for the "accommodation" kind')
    })

    test('rejects malformed details', () => {
        expect(() => applyStayFlags({}, { details: '{oops' }, 'accommodation')).toThrow('Invalid JSON in --details')
    })

    test('rejects details that are not an object', () => {
        expect(() => applyStayFlags({}, { details: '["x"]' }, 'accommodation')).toThrow('--details must be a JSON object')
    })

    test('rejects photos that are not a list', () => {
        expect(() => applyStayFlags({}, { photos: '{"url":"x"}' }, 'accommodation')).toThrow('--photos must be a JSON array')
    })
})
