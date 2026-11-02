import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { readJsonObject } from '../../util/json-file'
import { applyFreeCancellation } from './free-cancellation'
import { applyStayFlags } from './stay-details'

const KINDS = ['accommodation', 'transport', 'getting-around'] as const
type Kind = (typeof KINDS)[number]

function assertKind(value: string): asserts value is Kind {
    if (!(KINDS as readonly string[]).includes(value)) {
        throw new Error(`Invalid kind "${value}". Must be one of: ${KINDS.join(', ')}.`)
    }
}

export const optionsAddCommand = defineCommand({
    meta: {
        name: 'add',
        description:
            'Add an option (accommodation | transport | getting-around) to a destination from a JSON file.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        kind: {
            type: 'positional',
            description: 'Option kind: accommodation | transport | getting-around.',
        },
        'from-json': {
            type: 'string',
            required: true,
            description: 'Path to JSON file describing the option body.',
        },
        'free-cancellation-until': {
            type: 'string',
            description:
                'Accommodation only: free-cancellation deadline (YYYY-MM-DD or ISO date-time). Merged into the body.',
        },
        details: {
            type: 'string',
            description:
                "Accommodation only: stayDetails as JSON, e.g. '{\"highlight\":\"...\",\"kitchen\":\"private\"}'. Only facts that help choose between this trip's options.",
        },
        photos: {
            type: 'string',
            description:
                'Accommodation only: photos as a JSON array of { "url", "credit"? }. Only images the owner may use.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            assertKind(args.kind)
            const body = await readJsonObject(args['from-json'])
            applyFreeCancellation(body, args['free-cancellation-until'], args.kind)
            applyStayFlags(body, { details: args.details, photos: args.photos }, args.kind)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const path = {
                id: args.tripId,
                variantId: args.variantId,
                destinationKey: args.destinationKey,
            }

            let error: unknown
            let data: unknown
            if (args.kind === 'accommodation') {
                const res = await client.POST(
                    '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/accommodation',
                    { params: { path }, body: body as never },
                )
                error = res.error
                data = res.data
            } else if (args.kind === 'transport') {
                const res = await client.POST(
                    '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/transport',
                    { params: { path }, body: body as never },
                )
                error = res.error
                data = res.data
            } else {
                const res = await client.POST(
                    '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/getting-around',
                    { params: { path }, body: body as never },
                )
                error = res.error
                data = res.data
            }
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Added ${colors.bold(args.kind)} option on destination ${args.destinationKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
