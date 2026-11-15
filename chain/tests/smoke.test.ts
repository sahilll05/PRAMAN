import { describe, it, expect } from "vitest";
import { CHAIN_VERSION } from "../src/index.js";

describe("chain smoke", () => {
  it("package exports version", () => {
    expect(CHAIN_VERSION).toMatch(/^0\./);
  });
});
