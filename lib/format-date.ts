export function formatDateToIndonesian(dateString: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }

  const months = [
    'januari',
    'februari',
    'maret',
    'april',
    'mei',
    'juni',
    'juli',
    'agustus',
    'september',
    'oktober',
    'november',
    'desember',
  ]

  const [year, month, day] = dateString.split('-')
  const monthIndex = parseInt(month, 10) - 1

  if (monthIndex < 0 || monthIndex > 11) {
    return dateString
  }

  return `${day} ${months[monthIndex]} ${year}`
}
