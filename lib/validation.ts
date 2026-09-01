const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guard route params / action ids before they reach Postgres — a non-UUID
 * string otherwise throws error 22P02 and surfaces as an unhandled 500. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
