/** "Taylor Bennett" becomes "TB". Used wherever a person has no photo to show. */
export function initialsOf(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}
