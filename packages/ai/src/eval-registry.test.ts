import { describe, expect, it } from "vitest";
import { registerEvalSuite, getEvalSuite, listEvalSuiteKeys, type EvalCase } from "./eval-registry";

interface Output {
  answer: string;
}

const sampleCase: EvalCase<Output> = {
  name: "sample",
  variables: {},
  respond: () => JSON.stringify({ answer: "42" }),
  assertions: [],
};

describe("eval-registry", () => {
  it("registers and retrieves a suite by key and version", () => {
    registerEvalSuite("test_registry_case", 1, [sampleCase]);

    expect(getEvalSuite<Output>("test_registry_case", 1)).toEqual([sampleCase]);
  });

  it("returns undefined for an unregistered (key, version)", () => {
    expect(getEvalSuite("does_not_exist", 1)).toBeUndefined();
  });

  it("throws when the same (key, version) is registered twice", () => {
    registerEvalSuite("test_registry_dup", 1, [sampleCase]);

    expect(() => registerEvalSuite("test_registry_dup", 1, [sampleCase])).toThrow(
      /already registered/,
    );
  });

  it("allows the same key at a different version", () => {
    registerEvalSuite("test_registry_versioned", 1, [sampleCase]);
    registerEvalSuite("test_registry_versioned", 2, [sampleCase]);

    expect(getEvalSuite("test_registry_versioned", 1)).toBeDefined();
    expect(getEvalSuite("test_registry_versioned", 2)).toBeDefined();
  });

  it("lists every registered (key, version) pair", () => {
    registerEvalSuite("test_registry_listed", 3, [sampleCase]);

    const keys = listEvalSuiteKeys();
    expect(keys).toContainEqual({ key: "test_registry_listed", version: 3 });
  });
});
