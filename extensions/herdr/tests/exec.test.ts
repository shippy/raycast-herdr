import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveHerdrFromCandidates } from "../src/exec";

describe("resolveHerdrFromCandidates", () => {
  it("returns the preference path when it exists and is executable", () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
    const bin = join(dir, "herdr");
    writeFileSync(bin, "#!/bin/sh\nexit 0\n");
    chmodSync(bin, 0o755);
    expect(resolveHerdrFromCandidates(bin, [])).toBe(bin);
  });

  it("ignores an empty preference and falls back to candidates", () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
    const bin = join(dir, "herdr");
    writeFileSync(bin, "#!/bin/sh\nexit 0\n");
    chmodSync(bin, 0o755);
    expect(resolveHerdrFromCandidates("", [bin])).toBe(bin);
  });

  it("returns the first existing candidate", () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
    const a = join(dir, "herdr-a");
    const b = join(dir, "herdr-b");
    writeFileSync(a, "");
    chmodSync(a, 0o755);
    writeFileSync(b, "");
    chmodSync(b, 0o755);
    expect(resolveHerdrFromCandidates("", [a, b])).toBe(a);
  });

  it("returns null when nothing matches", () => {
    expect(resolveHerdrFromCandidates("", ["/nope/never"])).toBeNull();
  });
});
