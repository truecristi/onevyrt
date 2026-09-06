"use client";
/**
 * The BYO-AI connection + Copilot chat state from funnel-studio.tsx. Owns the
 * provider/key/model settings (persisted via lib/ai/client), the "test" ping,
 * the chat transcript, and the shared callAIChat wrapper. The snapshot-aware
 * callers (askCopilot, applyAiEdit, generateHooksWithAi) stay in the component
 * and use the setters/refs this hook returns — destructured with identical
 * names, so nothing downstream changes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type AIProviderId } from "../../ai/providers";
import { callAIChat, loadConnection, saveConnection, testConnection } from "../../ai/client";

export function useAiConnection() {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProviderId>("openrouter");
  const [aiKey, setAiKey] = useState("");
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  // Result of the optional "Test" ping — lets the user confirm a key/model
  // actually works before relying on it. Reset to idle whenever the connection
  // changes so a stale ✓/✗ never lingers over a different key.
  const [aiTest, setAiTest] = useState<{ state: "idle" | "testing" | "ok" | "err"; msg?: string }>({ state: "idle" });
  // Lets the Copilot's "Stop" button cancel an in-flight streaming generation.
  const aiAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const c = loadConnection();
    if (c) { setAiProvider(c.provider); setAiKey(c.apiKey); setAiModel(c.model); }
  }, []);

  const saveAiKey = useCallback(() => {
    const k = aiKeyInput.trim();
    saveConnection({ provider: aiProvider, apiKey: k, model: aiModel });
    setAiKey(k); setAiKeyInput(""); setAiErr(""); setAiTest({ state: "idle" });
  }, [aiKeyInput, aiProvider, aiModel]);
  const clearAiKey = useCallback(() => {
    saveConnection({ provider: aiProvider, apiKey: "", model: aiModel });
    setAiKey(""); setAiMessages([]); setAiErr(""); setAiTest({ state: "idle" });
  }, [aiProvider, aiModel]);
  const changeAiModel = useCallback((m: string) => {
    setAiModel(m);
    saveConnection({ provider: aiProvider, apiKey: aiKey, model: m });
    setAiTest({ state: "idle" });
  }, [aiProvider, aiKey]);
  const changeAiProvider = useCallback((p: AIProviderId) => {
    setAiProvider(p);
    saveConnection({ provider: p, apiKey: aiKey, model: aiModel });
    setAiTest({ state: "idle" });
  }, [aiKey, aiModel]);
  const testAiConnection = useCallback(async () => {
    setAiTest({ state: "testing" });
    const r = await testConnection({ provider: aiProvider, apiKey: aiKey, model: aiModel });
    setAiTest(r.ok ? { state: "ok" } : { state: "err", msg: r.error });
  }, [aiProvider, aiKey, aiModel]);
  // Every AI call in the app (Copilot chat + hook generation) routes through
  // lib/ai to whichever provider the user connected (OpenAI, Claude, Grok,
  // OpenRouter). The Copilot chat is called directly from the browser, so the
  // prompt goes straight to the provider (the key itself is stored encrypted
  // server-side so it survives restarts — see lib/ai/client syncAiConnection).
  const callOpenRouter = useCallback(async (system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens: number): Promise<string> => {
    return callAIChat({ provider: aiProvider, apiKey: aiKey, model: aiModel }, system, messages, maxTokens);
  }, [aiProvider, aiKey, aiModel]);

  return {
    aiOpen, setAiOpen, aiProvider, setAiProvider, aiKey, setAiKey, aiKeyInput, setAiKeyInput,
    aiModel, setAiModel, aiMessages, setAiMessages, aiInput, setAiInput, aiBusy, setAiBusy,
    aiErr, setAiErr, aiTest, setAiTest, aiAbortRef,
    saveAiKey, clearAiKey, changeAiModel, changeAiProvider, testAiConnection, callOpenRouter,
  };
}
