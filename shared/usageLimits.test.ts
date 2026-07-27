import { describe, expect, it, beforeEach } from "vitest";
import {
  FREE_TRANSFORMS_PER_DAY,
  assertAndConsumeUsage,
  __resetUsageMeterForTests,
} from "./usageLimits.ts";

describe("usageLimits", () => {
  beforeEach(() => {
    __resetUsageMeterForTests();
  });

  it("allows anon transforms up to the daily cap", () => {
    for (let i = 0; i < FREE_TRANSFORMS_PER_DAY; i++) {
      const result = assertAndConsumeUsage("install:test", false, "transform");
      expect(result.ok).toBe(true);
    }
    const blocked = assertAndConsumeUsage("install:test", false, "transform");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("free_limit");
  });

  it("isolates subjects and kinds", () => {
    expect(assertAndConsumeUsage("a", false, "transform").ok).toBe(true);
    expect(assertAndConsumeUsage("b", false, "transform").ok).toBe(true);
    expect(assertAndConsumeUsage("a", false, "chat").ok).toBe(true);
  });
});
