
export interface LeadDuplicateCheck {
  total: number
  matches: { kind: string; name: string | null; id: number | null; location: string | null; reasons: string[] }[]
}

export function describeLeadDuplicates(result: LeadDuplicateCheck) {
  const visible = result.matches.filter(match => match.name).map(match =>
    match.name + (match.location ? ' · ' + match.location : '') + ' (' + match.reasons.join(', ') + ')',
  )
  const hidden = result.total - visible.length
  if (hidden) visible.push(hidden + ' other possible match' + (hidden === 1 ? '' : 'es'))
  return visible.join('\n')
}
