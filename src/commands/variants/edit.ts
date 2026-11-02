import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { formatParty } from '../../render/party'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { buildVariantDates, variantDateArgs } from './dates'
import { fetchVariantParticipants, mergeParticipants, parsePartyChange, variantPartyArgs } from './party'

const POSITIONAL_COUNT = 2

export const variantsEditCommand = defineCommand({
    meta: { name: 'edit', description: 'Update fields on an existing variant.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        name: { type: 'string', description: 'New variant name.' },
        notes: { type: 'string', description: 'New variant notes.' },
        ...variantDateArgs,
        ...variantPartyArgs,
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const updates: Record<string, unknown> = {}
            if (args.name !== undefined) updates.name = args.name
            if (args.notes !== undefined) updates.notes = args.notes
            const dates = buildVariantDates(args)
            if (dates !== undefined) updates.dates = dates
            const partyChange = parsePartyChange(args, POSITIONAL_COUNT)
            if (Object.keys(updates).length === 0 && partyChange === undefined) {
                throw new Error('Specify at least one of --name, --notes, the date flags, or the party flags.')
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const participants =
                partyChange &&
                mergeParticipants(await fetchVariantParticipants(client, args.tripId, args.variantId), partyChange)
            if (participants !== undefined) updates.participants = participants

            const { data, error } = await client.PATCH('/v1/trips/{id}/variants/{variantId}', {
                params: { path: { id: args.tripId, variantId: args.variantId } },
                body: updates as never,
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Updated variant ${args.variantId}.\n`)
                if (participants !== undefined) process.stdout.write(`  Party: ${formatParty(participants)}\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
