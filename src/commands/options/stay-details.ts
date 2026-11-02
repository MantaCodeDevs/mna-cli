import { parseJsonFlag, parseJsonObjectFlag } from '../../util/json-flag'

/**
 * Merge the `--details` and `--photos` flags into an option body. Both fields
 * exist only on accommodation, so any other kind is rejected. A flag overrides
 * the same field in the `--from-json` file.
 */
export function applyStayFlags(
    body: Record<string, unknown>,
    flags: { details?: string; photos?: string },
    kind: string,
): void {
    if (flags.details === undefined && flags.photos === undefined) return
    if (kind !== 'accommodation') {
        throw new Error('--details and --photos are only valid for the "accommodation" kind.')
    }

    if (flags.details !== undefined) {
        body.stayDetails = parseJsonObjectFlag(flags.details, '--details')
    }
    if (flags.photos !== undefined) {
        const photos = parseJsonFlag(flags.photos, '--photos')
        if (photos !== null && !Array.isArray(photos)) {
            throw new Error(
                '--photos must be a JSON array of { "url": ..., "credit"?: ... }, or null to clear it.',
            )
        }
        body.photos = photos
    }
}
