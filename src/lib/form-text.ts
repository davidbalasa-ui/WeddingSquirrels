/**
 * A textarea submits its line breaks as CRLF (the HTML form-data rule), while the same
 * textarea shows and edits them as LF. Store what the person sees, so a note saved from a
 * form reads back byte-for-byte as typed and never carries stray carriage returns into the
 * day-of pages, the offline copy or a comparison.
 */
export function multilineFieldValue(raw: FormDataEntryValue | null | undefined): string {
  return String(raw ?? "").replace(/\r\n?/g, "\n").trim();
}
