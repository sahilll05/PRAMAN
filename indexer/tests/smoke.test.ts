import { describe, it, expect } from "vitest";
import { INDEXER_VERSION } from "../src/index.js";

describe("indexer smoke", () => {
  it("package exports version", () => {
    expect(INDEXER_VERSION).toMatch(/^0\./);
  });
});
