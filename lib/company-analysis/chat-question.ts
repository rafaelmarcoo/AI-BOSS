export function companyChatQuestion(selection: string, companyNames: string[]) {
  const names = [...new Set(companyNames.filter((name) => name.trim() !== ''))]
  const about =
    names.length === 0
      ? 'About these competitors'
      : names.length === 1
        ? `About ${names[0]}`
        : `About ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

  return `${about}: can you explain this?\n\n"${selection}"`
}
