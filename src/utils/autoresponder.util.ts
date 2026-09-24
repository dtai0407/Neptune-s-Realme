export function parseAutoresponderEmbedNames(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean))];
    }
  } catch {
  }

  return [value.trim().toLowerCase()].filter(Boolean);
}

export function serializeAutoresponderEmbedNames(names: string[]) {
  return names.length ? JSON.stringify(names) : null;
}
