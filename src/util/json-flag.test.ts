import { describe, expect, test } from 'bun:test'
import { parseJsonFlag, parseJsonObjectFlag } from './json-flag'

describe('parseJsonFlag', () => {
    test('parses a value', () => {
        expect(parseJsonFlag('[1,2]', '--x')).toEqual([1, 2])
    })

    test('names the flag when the JSON is malformed', () => {
        expect(() => parseJsonFlag('{oops', '--details')).toThrow('Invalid JSON in --details')
    })
})

describe('parseJsonObjectFlag', () => {
    test('accepts an object', () => {
        expect(parseJsonObjectFlag('{"a":1}', '--x')).toEqual({ a: 1 })
    })

    test('accepts null, which clears the field', () => {
        expect(parseJsonObjectFlag('null', '--x')).toBeNull()
    })

    test.each(['[1]', '"text"', '5'])('rejects %s', (value) => {
        expect(() => parseJsonObjectFlag(value, '--budget')).toThrow('--budget must be a JSON object')
    })
})
