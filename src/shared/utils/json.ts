export function sanitizeJsonString(text: string): string {
  let cleaned = text.replace(/^```json\n?|\n?```$/g, "").trim();
  cleaned = cleaned.replace(/^```\n?|\n?```$/g, "").trim();
  cleaned = cleaned.replace(/: '([\s\S]*?)'(?=[,}\]])/g, (_, content: string) => {
    const escaped = content.replace(/"/g, '\\"');
    return `: "${escaped}"`;
  });
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  cleaned = cleaned.replace(/"\s+/g, '" ').replace(/\s+"/g, ' "');
  return cleaned;
}
