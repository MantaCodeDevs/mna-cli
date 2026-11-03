/** Parse a JSON value passed directly on the command line, naming the flag when it is malformed. */
export function parseJsonFlag(value: string, flag: string): unknown {
    try {
        return JSON.parse(value)
    } catch (err) {
        throw new Error(`Invalid JSON in ${flag}: ${(err as Error).message}`)
    }
}

/** An object, or null where the API treats null as "clear this". */
export function parseJsonObjectFlag(value: string, flag: string): Record<string, unknown> | null {
    const parsed = parseJsonFlag(value, flag)

    if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
        throw new Error(`${flag} must be a JSON object, or null to clear it.`)
    }
    return parsed as Record<string, unknown> | null
}
