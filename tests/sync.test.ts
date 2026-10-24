import { it, expect } from "vitest";
import { migrationChanges } from "../lib/sync";
import { newPlace } from "../lib/model";
const p = (name: string, time: string) => ({
  ...newPlace(),
  name,
  updatedAt: time,
});
it("migrates local-only places without dropping cloud-only places", () => {
  const a = p("Local", "2026-10-25T12:00:00.000Z");
  const b = p("Cloud", "2026-10-24T12:00:00.000Z");
  expect(migrationChanges([a], [b])).toEqual([a]);
});
it("merges a newer local edit using the cloud identity", () => {
  const old = p("Cafe", "2026-10-24T12:00:00.000Z");
  const recent = {
    ...p("CAFE!", "2026-10-25T12:00:00.000Z"),
    notes: "PC note",
    favorite: true,
  };
  expect(migrationChanges([recent], [old])).toEqual([
    { ...recent, id: old.id, createdAt: old.createdAt },
  ]);
});
it("keeps newer cloud edits and does not resurrect equal-date migration entries", () => {
  const remote = p("Cafe", "2026-10-25T12:00:00.000Z");
  expect(
    migrationChanges([{ ...remote, notes: "old copy" }], [remote]),
  ).toEqual([]);
  expect(
    migrationChanges([p("Cafe", "2026-10-24T12:00:00.000Z")], [remote]),
  ).toEqual([]);
});
it("does not overwrite an unrelated cloud record with a colliding imported id", () => {
  const remote = p("Cloud", "2026-10-25T12:00:00.000Z");
  const local = { ...p("Local", "2026-10-25T12:00:00.000Z"), id: remote.id };
  expect(migrationChanges([local], [remote])[0].id).not.toBe(remote.id);
});
