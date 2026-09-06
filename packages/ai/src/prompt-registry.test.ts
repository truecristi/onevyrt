import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getPromptTemplate, registerPromptTemplate } from "./prompt-registry";

describe("prompt registry", () => {
  it("registers and retrieves a template by key and version", () => {
    registerPromptTemplate({
      key: "test_template_registry_a",
      version: 1,
      defaultMaxTokens: 100,
      outputSchema: z.object({ ok: z.boolean() }),
      render: () => ({ system: "sys", user: "usr" }),
    });

    const found = getPromptTemplate("test_template_registry_a", 1);
    expect(found?.key).toBe("test_template_registry_a");
    expect(found?.version).toBe(1);
  });

  it("returns undefined for an unregistered (key, version)", () => {
    expect(getPromptTemplate("does_not_exist", 1)).toBeUndefined();
  });

  it("allows two different versions of the same key, but rejects re-registering the same (key, version)", () => {
    registerPromptTemplate({
      key: "test_template_registry_b",
      version: 1,
      defaultMaxTokens: 100,
      outputSchema: z.object({ ok: z.boolean() }),
      render: () => ({ system: "sys v1", user: "usr" }),
    });
    registerPromptTemplate({
      key: "test_template_registry_b",
      version: 2,
      defaultMaxTokens: 100,
      outputSchema: z.object({ ok: z.boolean() }),
      render: () => ({ system: "sys v2", user: "usr" }),
    });

    expect(getPromptTemplate("test_template_registry_b", 1)?.render({}).system).toBe("sys v1");
    expect(getPromptTemplate("test_template_registry_b", 2)?.render({}).system).toBe("sys v2");

    expect(() =>
      registerPromptTemplate({
        key: "test_template_registry_b",
        version: 1,
        defaultMaxTokens: 100,
        outputSchema: z.object({ ok: z.boolean() }),
        render: () => ({ system: "sys", user: "usr" }),
      }),
    ).toThrow(/already registered/);
  });
});
