export function fullName(
  person?: { firstName: string; lastName: string } | null,
): string {
  return person ? `${person.firstName} ${person.lastName}` : '';
}
