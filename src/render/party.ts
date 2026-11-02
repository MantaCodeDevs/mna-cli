interface Party {
    adults: number
    children?: { age: number }[]
}

function pluralize(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`
}

export function formatParty(party: Party | undefined): string {
    if (!party) return ''

    const adults = pluralize(party.adults, 'adult', 'adults')
    const children = party.children ?? []
    if (children.length === 0) return adults

    const ages = children.map((child) => child.age).join(', ')
    return `${adults}, ${pluralize(children.length, 'child', 'children')} (${ages})`
}
