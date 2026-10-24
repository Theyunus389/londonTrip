import { duplicateKey, placeSchema, type Place } from "./model";
/** Cloud identity wins; a newer browser edit keeps its content under that identity. */
export function migrationChanges(local: Place[], cloud: Place[]): Place[] {
  const byName = new Map(cloud.map((p) => [duplicateKey(p), p]));
  return local.flatMap((p) => {
    const remote = byName.get(duplicateKey(p));
    if (!remote)
      return [
        {
          ...p,
          id: cloud.some((x) => x.id === p.id) ? crypto.randomUUID() : p.id,
        },
      ];
    if (p.updatedAt > remote.updatedAt)
      return [{ ...p, id: remote.id, createdAt: remote.createdAt }];
    return [];
  });
}
export type Snapshot = {
  trip: { id: string; settings: { name: string } } | null;
  trips: { id: string; settings: { name: string } }[];
  places: Place[];
};
export function snapshot(value: unknown): Snapshot {
  const v = value as Snapshot;
  return { ...v, places: placeSchema.array().parse(v.places) };
}
