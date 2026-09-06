"use client";

/**
 * Mounted once at the app root. On load it reconciles the browser's cached AI
 * connection with the durable server copy (lib/ai/client → syncAiConnection):
 * hydrates the local cache from the server's stored key, or migrates a
 * pre-existing browser key up to the server so it survives the next clear.
 *
 * Renders nothing. Best-effort and silent — no-ops when signed out, offline, or
 * server-side key storage isn't configured.
 */
import { useEffect } from "react";
import { syncAiConnection } from "../lib/ai/client";

export default function AiConnectionSync() {
  useEffect(() => { void syncAiConnection(); }, []);
  return null;
}
