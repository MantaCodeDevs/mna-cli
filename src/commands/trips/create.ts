import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const tripsCreateCommand = defineCommand({
    meta: { name: 'create', description: 'Create a new trip.' },
    args: {
        name: { type: 'string', required: true, description: 'Trip name.' },
        'cover-photo': { type: 'string', description: 'Cover photo, which you should always set: one of northernlight, beach, mountain, town, snow, sea, road, jungle, desert, city, balaton, london, or an http or https image URL.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/trips', {
                body: { name: args.name, coverPhoto: args['cover-photo'] ?? '' },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            // The OpenAPI spec doesn't declare a response schema for POST /v1/trips,
            // so openapi-fetch types `data` as never/undefined even though the server
            // actually returns `{ id, name }`. Cast through unknown to recover it.
            const created = data as unknown as { id: string; name: string } | undefined

            if (args.json) {
                renderJson(created)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Created trip ${colors.bold(created?.name ?? args.name)} (${created?.id ?? ''})\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
