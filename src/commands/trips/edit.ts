import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { parseJsonObjectFlag } from '../../util/json-flag'

const VALID_STATUSES = ['planning', 'ready', 'finished', 'cancelled'] as const
type TripStatus = (typeof VALID_STATUSES)[number]

function isStatus(s: string): s is TripStatus {
    return (VALID_STATUSES as readonly string[]).includes(s)
}

export const tripsEditCommand = defineCommand({
    meta: { name: 'edit', description: 'Update trip-level fields.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        name: { type: 'string', description: 'New name.' },
        'cover-photo': { type: 'string', description: 'New cover photo: one of northernlight, beach, mountain, town, snow, sea, road, jungle, desert, city, balaton, london, or an http or https image URL.' },
        status: { type: 'string', description: `New status (${VALID_STATUSES.join('|')}).` },
        budget: {
            type: 'string',
            description:
                'Owner only: budget as JSON, e.g. \'{"amount":4000,"currency":"EUR","appliesTo":"stay"}\' (appliesTo: stay|total), or null to clear it.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const updates: Record<string, unknown> = {}
            if (args.name !== undefined) updates.name = args.name
            if (args['cover-photo'] !== undefined) updates.coverPhoto = args['cover-photo']
            if (args.status !== undefined) {
                if (!isStatus(args.status)) {
                    throw new Error(`Invalid status. Choose one of: ${VALID_STATUSES.join(', ')}.`)
                }
                updates.status = args.status
            }
            if (args.budget !== undefined) {
                updates.budget = parseJsonObjectFlag(args.budget, '--budget')
            }
            if (Object.keys(updates).length === 0) {
                throw new Error('Specify at least one of --name, --cover-photo, --status, --budget.')
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.PATCH('/v1/trips/{id}', {
                params: { path: { id: args.tripId } },
                body: updates as never,
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Updated trip ${args.tripId}.\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
