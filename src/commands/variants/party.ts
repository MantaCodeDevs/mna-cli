import type { Api } from '../../api/client'
import type { components } from '../../api/generated/schema'

type Participants = components['schemas']['TripVariantParticipantsV1Dto']
type Child = Participants['children'][number]

export interface PartyChange {
    adults?: number
    children?: Child[]
}

const MIN_ADULTS = 1
const MAX_CHILD_AGE = 17
const WHOLE_NUMBER = /^\d+$/
const READ_EVERY_VARIANT = { includeAllOptions: true }

/** Party flags shared by `variants add` and `variants edit`. */
export const variantPartyArgs = {
    adults: { type: 'string', description: `Number of adults travelling (at least ${MIN_ADULTS}).` },
    'child-ages': {
        type: 'string',
        description: `Children's ages, one per child, comma-separated or repeated: --child-ages 8,5. Each 0-${MAX_CHILD_AGE}.`,
    },
    children: {
        type: 'boolean',
        description: 'Use --no-children for an adults-only party (removes any children already set).',
    },
} as const

function parseWholeNumber(value: string): number | undefined {
    const trimmed = value.trim()
    const parsed = Number(trimmed)
    return WHOLE_NUMBER.test(trimmed) && Number.isSafeInteger(parsed) ? parsed : undefined
}

function parseAdults(value: unknown): number | undefined {
    if (value === undefined) return undefined
    if (Array.isArray(value)) throw new Error('--adults was given more than once.')

    const adults = parseWholeNumber(String(value))
    if (adults === undefined || adults < MIN_ADULTS) {
        throw new Error(`Invalid adult count for --adults: "${value}". Use a whole number of at least ${MIN_ADULTS}.`)
    }
    return adults
}

function parseChildAge(value: string): Child {
    const age = parseWholeNumber(value)
    if (age === undefined || age > MAX_CHILD_AGE) {
        throw new Error(
            `Invalid child age for --child-ages: "${value.trim()}". Use a whole number from 0 to ${MAX_CHILD_AGE}; anyone older counts as an adult.`,
        )
    }
    return { age }
}

function parseChildAges(value: unknown): Child[] | undefined {
    if (value === undefined) return undefined

    const entries = [value].flat().flatMap((entry) => String(entry).split(','))
    if (entries.every((entry) => entry.trim() === '')) {
        throw new Error('--child-ages needs at least one age, e.g. --child-ages 8,5. For no children use --no-children.')
    }
    return entries.map(parseChildAge)
}

function rejectSpaceSeparatedAges(args: Record<string, unknown>, positionalCount: number): void {
    const positionals = (args._ as unknown[] | undefined) ?? []
    const extras = positionals.slice(positionalCount)
    if (args['child-ages'] !== undefined && extras.length > 0) {
        throw new Error(`Unexpected argument: ${extras.join(' ')}. Separate child ages with commas: --child-ages 8,5.`)
    }
}

/** Reads the party flags, or returns undefined when none were given. */
export function parsePartyChange(args: Record<string, unknown>, positionalCount: number): PartyChange | undefined {
    if (args.children === true) {
        throw new Error('--children does not take ages. Use --child-ages to list them, or --no-children for none.')
    }
    if (args.children === false && args['child-ages'] !== undefined) {
        throw new Error('--child-ages and --no-children contradict each other. Use one of them.')
    }
    rejectSpaceSeparatedAges(args, positionalCount)

    const adults = parseAdults(args.adults)
    const children = args.children === false ? [] : parseChildAges(args['child-ages'])
    if (adults === undefined && children === undefined) return undefined
    return { adults, children }
}

/** The party to create a variant with, or undefined to leave the API's solo-adult default. */
export function participantsForNewVariant(change: PartyChange | undefined): Participants | undefined {
    if (change === undefined) return undefined
    if (change.adults === undefined) {
        throw new Error('--adults is required with --child-ages or --no-children when adding a variant.')
    }
    return { adults: change.adults, children: change.children ?? [] }
}

/**
 * The API replaces `participants` wholesale, so whatever this change leaves alone
 * has to be sent back as it was. Only declared fields are copied: reads carry
 * Mongo `_id`s on the party and on each child, and writes reject unknown fields.
 */
export function mergeParticipants(current: Participants, change: PartyChange): Participants {
    return {
        adults: change.adults ?? current.adults,
        children: (change.children ?? current.children).map(({ age }) => ({ age })),
        numberOfRooms: current.numberOfRooms ?? undefined,
    }
}

export async function fetchVariantParticipants(client: Api, tripId: string, variantId: string): Promise<Participants> {
    const { data, error } = await client.GET('/v1/trips/{id}', {
        params: { path: { id: tripId }, query: READ_EVERY_VARIANT as never },
    })
    if (error) throw new Error(`Unexpected error fetching trip: ${JSON.stringify(error)}`)

    const variant = data?.variants?.find((candidate) => candidate.id === variantId)
    if (!variant) throw new Error(`Variant ${variantId} not found on trip ${tripId}.`)
    return variant.participants
}
