/**
 * Avatar letters: the first letter of the last two words of a name ("Nguyễn Thu Hà" -> "TH"),
 * the part Vietnamese speakers use to address someone.
 */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
