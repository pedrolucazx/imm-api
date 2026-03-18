export function getTodayUTCString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
