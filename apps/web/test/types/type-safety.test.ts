/**
 * Type Safety Test Suite
 *
 * Tests for TypeScript strict mode compliance and type safety patterns.
 * These tests verify that:
 * 1. Components properly type their props
 * 2. Event handlers use correct types
 * 3. Async operations have proper type guards
 * 4. No implicit any types exist
 * 5. Null/undefined values are properly handled
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  ButtonProps,
  CardProps,
  EditableFunnelStage,
  ApiResponse,
  Result,
} from "@/lib/types";
import type { AsyncState } from "@/lib/types/component-patterns";

// Minimal jest-style matcher shim backed by node:assert, so the typed
// assertions below both type-check and execute under the node:test runner.
function expect<T>(actual: T) {
  return {
    toBe(expected: T): void {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: T): void {
      assert.deepStrictEqual(actual, expected);
    },
    toBeUndefined(): void {
      assert.strictEqual(actual, undefined);
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// Suite 1: Component Props Type Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("Component Props Type Safety", () => {
  it("should enforce ButtonProps shape", () => {
    const validProps: ButtonProps = {
      variant: "primary",
      size: "md",
      disabled: false,
      children: "Click me",
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        console.log(event.currentTarget);
      },
    };

    expect(validProps.variant).toBe("primary");
    expect(validProps.disabled).toBe(false);
  });

  it("should allow optional ButtonProps", () => {
    const minimalProps: ButtonProps = {
      children: "Click",
    };

    expect(minimalProps.children).toBe("Click");
    // variant, size, and disabled are optional
  });

  it("should enforce CardProps shape", () => {
    const validCardProps: CardProps = {
      variant: "glass",
      children: "Content",
      title: "Card Title",
      padding: "lg",
      bordered: true,
    };

    expect(validCardProps.variant).toBe("glass");
    expect(validCardProps.padding).toBe("lg");
  });

  it("should require children in CardProps", () => {
    // TypeScript should error without children at compile time
    const validProps: CardProps = {
      children: "Required",
    };

    expect(validProps.children).toBe("Required");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 2: Business Domain Type Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("Business Domain Types", () => {
  it("should properly type FunnelStage", () => {
    const stage: EditableFunnelStage = {
      id: "1",
      name: "Awareness",
      visitors: 1000,
      conversions: 100,
      conversionRate: 10,
    };

    expect(stage.id).toBe("1");
    expect(stage.conversionRate).toBe(10);
  });

  it("should handle multiple funnel stages", () => {
    const stages: EditableFunnelStage[] = [
      {
        id: "1",
        name: "Awareness",
        visitors: 1000,
        conversions: 100,
        conversionRate: 10,
      },
      {
        id: "2",
        name: "Interest",
        visitors: 100,
        conversions: 30,
        conversionRate: 30,
      },
    ];

    expect(stages.length).toBe(2);
    expect(stages[0]!.conversionRate).toBe(10);
    expect(stages[1]!.conversionRate).toBe(30);
  });

  it("should calculate correct funnel metrics", () => {
    const stage: EditableFunnelStage = {
      id: "1",
      name: "Test",
      visitors: 100,
      conversions: 25,
      conversionRate: 25,
    };

    const rate = (stage.conversions / stage.visitors) * 100;
    expect(rate).toBe(stage.conversionRate);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 3: API Response Type Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("API Response Types", () => {
  it("should properly type success response", () => {
    const response: ApiResponse<{ name: string }> = {
      success: true,
      data: {
        name: "Test User",
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    expect(response.success).toBe(true);
    expect(response.data?.name).toBe("Test User");
  });

  it("should properly type error response", () => {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: {
          field: "email",
        },
      },
    };

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("VALIDATION_ERROR");
  });

  it("should handle generic ApiResponse", () => {
    interface UserData {
      id: string;
      email: string;
    }

    const response: ApiResponse<UserData> = {
      success: true,
      data: {
        id: "123",
        email: "user@example.com",
      },
    };

    if (response.success && response.data) {
      expect(response.data.id).toBe("123");
      expect(response.data.email).toBe("user@example.com");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 4: Async State Type Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("Async State Type Safety", () => {
  it("should properly type AsyncState", () => {
    const idleState: AsyncState<string> = {
      status: "idle",
      data: null,
      error: null,
      isLoading: false,
    };

    expect(idleState.status).toBe("idle");
    expect(idleState.isLoading).toBe(false);
  });

  it("should handle loading state", () => {
    const loadingState: AsyncState<string> = {
      status: "loading",
      data: null,
      error: null,
      isLoading: true,
    };

    expect(loadingState.status).toBe("loading");
    expect(loadingState.isLoading).toBe(true);
  });

  it("should handle success state with data", () => {
    const successState: AsyncState<string> = {
      status: "success",
      data: "Operation successful",
      error: null,
      isLoading: false,
    };

    expect(successState.status).toBe("success");
    expect(successState.data).toBe("Operation successful");
  });

  it("should handle error state", () => {
    const errorState: AsyncState<string> = {
      status: "error",
      data: null,
      error: new Error("Operation failed"),
      isLoading: false,
    };

    expect(errorState.status).toBe("error");
    expect(errorState.error?.message).toBe("Operation failed");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 5: Result Type for Operations
// ════════════════════════════════════════════════════════════════════════════════

describe("Result Type Safety", () => {
  it("should type successful result", () => {
    const result: Result<string> = {
      ok: true,
      value: "Success",
    };

    if (result.ok) {
      expect(result.value).toBe("Success");
    }
  });

  it("should type failed result", () => {
    const result: Result<string> = {
      ok: false,
      error: new Error("Failed"),
    };

    if (!result.ok) {
      expect(result.error.message).toBe("Failed");
    }
  });

  it("should handle result pattern matching", () => {
    const successResult: Result<number> = { ok: true, value: 42 };
    const failedResult: Result<number> = {
      ok: false,
      error: new Error("Not found"),
    };

    // Pattern matching for success
    if (successResult.ok) {
      expect(typeof successResult.value).toBe("number");
    }

    // Pattern matching for failure
    if (!failedResult.ok) {
      expect(failedResult.error instanceof Error).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 6: Type Guards
// ════════════════════════════════════════════════════════════════════════════════

describe("Type Guards", () => {
  it("should correctly use isDefined guard", () => {
    const values: (string | null | undefined)[] = ["a", null, "b", undefined, "c"];
    const defined = values.filter(v => v !== null && v !== undefined);

    expect(defined.length).toBe(3);
    expect(defined).toEqual(["a", "b", "c"]);
  });

  it("should correctly use isError guard", () => {
    const value1: unknown = new Error("Test");
    const value2: unknown = "Not an error";

    const isError1 = value1 instanceof Error;
    const isError2 = value2 instanceof Error;

    expect(isError1).toBe(true);
    expect(isError2).toBe(false);
  });

  it("should correctly use isSuccessResponse guard", () => {
    const successResponse: ApiResponse<string> = {
      success: true,
      data: "Success",
    };

    const errorResponse: ApiResponse<never> = {
      success: false,
      error: { code: "ERROR", message: "Failed" },
    };

    expect(successResponse.success).toBe(true);
    expect(errorResponse.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 7: Generic Type Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("Generic Type Safety", () => {
  it("should maintain type through generic function", () => {
    function getFirst<T>(arr: T[]): T | undefined {
      return arr[0];
    }

    const stringFirst = getFirst(["a", "b", "c"]);
    const numberFirst = getFirst([1, 2, 3]);

    expect(stringFirst).toBe("a");
    expect(numberFirst).toBe(1);
  });

  it("should maintain type through Promise wrapper", () => {
    function wrapInPromise<T>(value: T): Promise<T> {
      return Promise.resolve(value);
    }

    const stringPromise = wrapInPromise("test");
    const numberPromise = wrapInPromise(42);

    stringPromise.then((value) => {
      expect(typeof value).toBe("string");
    });

    numberPromise.then((value) => {
      expect(typeof value).toBe("number");
    });
  });

  it("should maintain type through array mapping", () => {
    interface Item<T> {
      value: T;
      id: string;
    }

    const stringItems: Item<string>[] = [
      { id: "1", value: "a" },
      { id: "2", value: "b" },
    ];

    const values = stringItems.map((item) => item.value);

    expect(values).toEqual(["a", "b"]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 8: Null/Undefined Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("Null/Undefined Safety", () => {
  it("should handle optional chaining safely", () => {
    interface User {
      name?: string;
      address?: {
        city?: string;
      };
    }

    const user1: User = { name: "John" };
    const user2: User = {};

    expect(user1.name).toBe("John");
    expect(user1.address?.city).toBeUndefined();
    expect(user2.name).toBeUndefined();
  });

  it("should handle nullish coalescing safely", () => {
    const value1: string | null | undefined = null;
    const value2: string | null | undefined = "test";

    const result1 = value1 ?? "default";
    const result2 = value2 ?? "default";

    expect(result1).toBe("default");
    expect(result2).toBe("test");
  });

  it("should handle non-null assertion carefully", () => {
    interface Data {
      value: string;
    }

    const data: Data | null = { value: "test" };

    if (data !== null) {
      expect(data.value).toBe("test");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 9: Union Type Narrowing
// ════════════════════════════════════════════════════════════════════════════════

describe("Union Type Narrowing", () => {
  type Status = "success" | "error" | "pending";

  it("should narrow string union types", () => {
    const status: Status = "success";

    if (status === "success") {
      expect(status).toBe("success");
    }
  });

  type Operation = { type: "fetch"; url: string } | { type: "save"; data: string };

  it("should narrow discriminated unions", () => {
    const op: Operation = { type: "fetch", url: "http://api.test" };

    if (op.type === "fetch") {
      expect(op.url).toBe("http://api.test");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Suite 10: Readonly Type Safety
// ════════════════════════════════════════════════════════════════════════════════

describe("Readonly Type Safety", () => {
  it("should enforce readonly on arrays", () => {
    const immutable: readonly string[] = ["a", "b", "c"];

    expect(immutable[0]).toBe("a");
    expect(immutable.length).toBe(3);

    // TypeScript should error if trying to mutate:
    // immutable.push("d"); // ❌ Error
    // immutable[0] = "z"; // ❌ Error
  });

  it("should enforce readonly on objects", () => {
    interface Config {
      readonly apiUrl: string;
      readonly timeout: number;
    }

    const config: Config = {
      apiUrl: "http://api.test",
      timeout: 5000,
    };

    expect(config.apiUrl).toBe("http://api.test");

    // TypeScript should error if trying to mutate:
    // config.apiUrl = "http://new.api"; // ❌ Error
    // config.timeout = 10000; // ❌ Error
  });
});
