/**
 * Data retention policies API: manage retention policies and view compliance status.
 *
 * GET: Get retention policies and compliance status for a workspace
 * POST: Create or update a retention policy
 */

import { currentUser } from "../../../../../lib/auth";
import { listForUser } from "../../../../../lib/workspaces";
import { withRouteLogging } from "../../../../../lib/logger";
import {
  getRetentionPolicies,
  getOrCreateRetentionPolicy,
  updateRetentionPolicy,
  getWorkspaceComplianceStatus,
  getComplianceReports,
  DEFAULT_POLICIES,
} from "../../../../../lib/data-management/retention";

const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

export const GET = withRouteLogging("api/account/data-management/retention-policies:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const includeComplianceStatus = url.searchParams.get("includeComplianceStatus") === "true";
  const includeReports = url.searchParams.get("includeReports") === "true";

  if (!workspaceId) return json({ error: "workspaceId required" }, 400);

  const workspaces = await listForUser(user.id);
  if (!workspaces.find((w) => w.id === workspaceId)) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  try {
    const policies = await getRetentionPolicies(workspaceId);

    // Ensure all default policy types are represented
    for (const dataType of Object.keys(DEFAULT_POLICIES)) {
      if (!policies.find((p) => p.data_type === dataType)) {
        const policy = await getOrCreateRetentionPolicy(workspaceId, dataType);
        policies.push(policy);
      }
    }

    const response: any = { policies };

    if (includeComplianceStatus) {
      response.compliance = await getWorkspaceComplianceStatus(workspaceId);
    }

    if (includeReports) {
      const { records: reports } = await getComplianceReports(workspaceId);
      response.recentReports = reports.slice(0, 10);
    }

    return json(response);
  } catch (error) {
    console.error("Retention policy retrieval error:", error);
    return json({ error: "failed to retrieve retention policies" }, 500);
  }
});

export const POST = withRouteLogging("api/account/data-management/retention-policies:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const body = await req.json() as any;
  const { workspaceId, policyId, dataType, softDeleteDays, hardDeleteDays, autoDeleteEnabled, complianceNote } = body;

  if (!workspaceId || !dataType) {
    return json({ error: "workspaceId and dataType required" }, 400);
  }

  const workspaces = await listForUser(user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  // Only owners can modify retention policies
  if (workspace.ownerId !== user.id) {
    return json({ error: "only workspace owners can modify retention policies" }, 403);
  }

  try {
    let policy;

    if (policyId) {
      // Update existing policy
      policy = await updateRetentionPolicy(policyId, {
        soft_delete_days: softDeleteDays,
        hard_delete_days: hardDeleteDays,
        auto_delete_enabled: autoDeleteEnabled,
        compliance_note: complianceNote,
      });
    } else {
      // Create new policy
      policy = await getOrCreateRetentionPolicy(
        workspaceId,
        dataType,
      );

      // Update if values provided
      if (softDeleteDays !== undefined || hardDeleteDays !== undefined || autoDeleteEnabled !== undefined) {
        policy = await updateRetentionPolicy(policy.id, {
          soft_delete_days: softDeleteDays ?? policy.soft_delete_days,
          hard_delete_days: hardDeleteDays ?? policy.hard_delete_days,
          auto_delete_enabled: autoDeleteEnabled !== undefined ? autoDeleteEnabled : policy.auto_delete_enabled,
          compliance_note: complianceNote,
        });
      }
    }

    return json(policy, policyId ? 200 : 201);
  } catch (error) {
    console.error("Retention policy update error:", error);
    return json({ error: "failed to update retention policy" }, 500);
  }
});
