import { newPlace, placeSchema, duplicateKey, type Place } from "./model";
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else throw Error("Invalid CSV quote");
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseImport(text: string, existing: Place[]) {
  if (text.length > 3_000_000) throw Error("Import must be smaller than 3 MB");
  let raw: unknown[];
  if (text.trim().startsWith("[")) {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) throw Error("Expected a JSON array");
    raw = value;
  } else {
    const [headers, ...rows] = csvRows(text.replace(/^\uFEFF/, ""));
    if (!headers) throw Error("No rows found");
    raw = rows.map((r) =>
      Object.fromEntries(headers.map((h, i) => [h.trim(), r[i] ?? ""])),
    );
  }
  if (raw.length > 200) throw Error("Import up to 200 places at a time");
  const seen = new Set(existing.map(duplicateKey));
  const places: Place[] = [],
    errors: string[] = [];
  raw.forEach((r, i) => {
    if (!r || typeof r !== "object") {
      errors.push(`Row ${i + 1}: expected an object`);
      return;
    }
    const data = r as Record<string, unknown>;
    const base: Record<string, unknown> = {
      ...newPlace(),
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demo: data.demo === true || data.demo === "true",
    };
    for (const key of ["lat", "lng", "price"]) {
      base[key] =
        data[key] == null || data[key] === "" ? null : Number(data[key]);
    }
    for (const key of ["favorite", "visited", "planned"])
      base[key] = data[key] === true || data[key] === "true";
    if (data.imageUrl && !data.images) base.images = [data.imageUrl];
    if (typeof data.images === "string")
      base.images = data.images ? [data.images] : [];
    const parsed = placeSchema.safeParse(base);
    if (!parsed.success) {
      errors.push(
        `Row ${i + 1}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
      );
      return;
    }
    const k = duplicateKey(parsed.data);
    if (seen.has(k)) {
      errors.push(`Row ${i + 1}: duplicate “${parsed.data.name}”`);
      return;
    }
    seen.add(k);
    places.push(parsed.data);
  });
  return { places, errors };
}
