import { pgPool } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

/**
 * Reflection Reminder Job
 *
 * Runs daily to check for workspaces that are due for a 90-day reflection.
 * Sends a notification to owners/managers to prompt reflection.
 *
 * Called from: lib/jobs.ts
 * Schedule: Daily (via external cron)
 */

export async function runReflectionReminderJob(): Promise<{
  checked: number;
  reminded: number;
}> {
  let checked = 0;
  let reminded = 0;
  const pool = pgPool();

  try {
    // Find all workspaces with a reflection checkpoint
    const checkpoints = await pool.query(
      `SELECT DISTINCT workspace_id
       FROM workspace_90day_reflections
       WHERE created_at > NOW() - INTERVAL '90 days'
       ORDER BY workspace_id`
    );

    // For each workspace with a recent reflection, check if 90 days have passed
    for (const row of checkpoints.rows) {
      checked++;
      const workspaceId = row.workspace_id;

      const latestReflection = await pool.query(
        `SELECT created_at FROM workspace_90day_reflections
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [workspaceId]
      );

      if (!latestReflection.rows[0]) continue;

      const daysSince =
        (Date.now() - new Date(latestReflection.rows[0].created_at).getTime()) /
        (24 * 60 * 60 * 1000);

      // Check if exactly 90 days (send once per day when threshold is hit)
      if (daysSince >= 90 && daysSince < 91) {
        // Get workspace owner/managers
        const owners = await pool.query(
          `SELECT u.id, u.email
           FROM users u
           JOIN workspaces_users wu ON u.id = wu.user_id
           WHERE wu.workspace_id = $1
             AND wu.role IN ('owner', 'manager')`,
          [workspaceId]
        );

        // Send notification to each owner/manager
        for (const owner of owners.rows) {
          try {
            await createNotification({
              userId: owner.id,
              workspaceId,
              type: "reflection_checkpoint_due",
              title: "Time for Your 90-Day Reflection",
              body:
                "It's been 90 days since your last reflection. Pause and capture how your Why and Creed have evolved.",
              dedupeKey: `reflection_checkpoint_due:${workspaceId}:${Math.floor(daysSince)}`,
            });

            reminded++;
          } catch (error) {
            console.error(
              `Failed to notify user ${owner.id} for reflection checkpoint:`,
              error
            );
          }
        }
      }
    }

    // Also check for workspaces that have NO reflection yet but are > 90 days old
    const staleWorkspaces = await pool.query(
      `SELECT w.id
       FROM workspaces w
       WHERE w.deleted_at IS NULL
         AND w.created_at < NOW() - INTERVAL '90 days'
         AND NOT EXISTS (
           SELECT 1 FROM workspace_90day_reflections
           WHERE workspace_id = w.id
         )
       ORDER BY w.id`
    );

    for (const row of staleWorkspaces.rows) {
      checked++;
      const workspaceId = row.id;

      // Get workspace owner/managers
      const owners = await pool.query(
        `SELECT u.id, u.email
         FROM users u
         JOIN workspaces_users wu ON u.id = wu.user_id
         WHERE wu.workspace_id = $1
           AND wu.role IN ('owner', 'manager')`,
        [workspaceId]
      );

      // Send "first reflection" invitation to each owner/manager
      for (const owner of owners.rows) {
        try {
          await createNotification({
            userId: owner.id,
            workspaceId,
            type: "reflection_checkpoint_first",
            title: "Start Your 90-Day Reflection Journey",
            body:
              "Your business has been growing for 90 days. Reflect on how your purpose and commitment have evolved.",
            dedupeKey: `reflection_checkpoint_first:${workspaceId}`,
          });

          reminded++;
        } catch (error) {
          console.error(
            `Failed to notify user ${owner.id} for first reflection:`,
            error
          );
        }
      }
    }

    console.log(
      `[Reflection Reminder Job] Checked ${checked} workspaces, sent ${reminded} reminders`
    );

    return { checked, reminded };
  } catch (error) {
    console.error("[Reflection Reminder Job] Error:", error);
    throw error;
  }
}
