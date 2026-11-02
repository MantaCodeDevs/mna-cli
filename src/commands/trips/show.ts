import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { accommodationRows } from '../../render/accommodation'
import { colors } from '../../render/colors'
import { formatParty } from '../../render/party'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const tripsShowCommand = defineCommand({
    meta: {
        name: 'show',
        description: 'Show full details of one trip.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        'all-options': {
            type: 'boolean',
            description: 'Include unselected option types in the output.',
            default: false,
        },
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)

            const client = createApiClient({
                baseUrl: resolveBaseUrl(creds),
                apiKey,
            })

            const query: Record<string, unknown> = {}
            if (args['all-options']) query.includeAllOptions = true

            const { data, error } = await client.GET('/v1/trips/{id}', {
                params: { path: { id: args.tripId }, query: query as never },
            })
            if (error) {
                throw new Error(`Unexpected error fetching trip: ${JSON.stringify(error)}`)
            }
            if (!data) {
                throw new Error('No trip returned.')
            }

            if (args.json) {
                renderJson(data)
                return
            }

            const stdout = process.stdout
            stdout.write(`${colors.bold(data.name)}  ${colors.dim(`(${data.id})`)}\n`)
            stdout.write(`Status: ${data.status}\n`)
            if (data.selectedVariant) {
                stdout.write(`Selected variant: ${data.selectedVariant}\n`)
            }
            stdout.write(`Variants: ${data.variants?.length ?? 0}\n\n`)

            renderTable({
                columns: [
                    { header: 'Variant', key: 'name', maxWidth: 30 },
                    { header: 'Party', key: 'party' },
                    { header: 'Destinations', key: 'destinationsCount' },
                    { header: 'Events', key: 'eventsCount' },
                ],
                rows:
                    data.variants?.map((v) => ({
                        name: v.name,
                        party: formatParty(v.participants),
                        destinationsCount: v.destinations?.length ?? 0,
                        eventsCount: v.eventsToAttend?.length ?? 0,
                    })) ?? [],
                emptyMessage: 'No variants yet.',
            })

            for (const variant of data.variants ?? []) {
                const rows = accommodationRows(variant.destinations)
                if (rows.length === 0) continue

                stdout.write(`\n${colors.bold('Accommodation')} ${colors.dim(`· ${variant.name}`)}\n`)
                renderTable({
                    columns: [
                        { header: 'Destination', key: 'destination', maxWidth: 18 },
                        { header: 'Option', key: 'option', maxWidth: 28 },
                        { header: 'Cost', key: 'cost', maxWidth: 12 },
                        { header: 'Rating', key: 'rating', maxWidth: 13 },
                        { header: 'Details', key: 'details', maxWidth: 28 },
                        { header: 'Facilities', key: 'features', maxWidth: 36 },
                    ],
                    rows,
                })
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
