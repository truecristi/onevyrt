/**
 * Admin utility to enable free-access mode for a workspace.
 * Used by admin scripts and CLI commands.
 */
import { pgPool } from "../db";

export async function enableFreeAccessForWorkspace(query: string): Promise<void> {
  const pool = pgPool();

  try {
    console.log(`Looking for workspace: ${query}`);

    // Try matching by ID first, then by name pattern
    let res = await pool.query(
      'SELECT id, name, free_access_mode FROM workspaces WHERE id = $1',
      [query]
    );

    if (!res.rows.length) {
      res = await pool.query(
        'SELECT id, name, free_access_mode FROM workspaces WHERE lower(name) LIKE lower($1)',
        [`%${query}%`]
      );
    }

    if (!res.rows.length) {
      console.error(`❌ No workspace found matching: ${query}`);
      process.exit(1);
    }

    if (res.rows.length > 1) {
      console.error("❌ Multiple workspaces found:");
      res.rows.forEach((row) => {
        console.error(`  - ${row.id}: ${row.name} (free_access_mode: ${row.free_access_mode})`);
      });
      console.error("\nPlease be more specific.");
      process.exit(1);
    }

    const [ws] = res.rows;
    if (ws.free_access_mode) {
      console.log(`✅ Workspace "${ws.name}" already has free-access mode enabled.`);
    } else {
      console.log(`Enabling free-access mode for workspace: "${ws.name}" (${ws.id})`);
      await pool.query(
        "UPDATE workspaces SET free_access_mode = true WHERE id = $1",
        [ws.id]
      );
      console.log("✅ Free-access mode enabled successfully.");
      console.log(`   All lessons are now unlocked for learners in this workspace.`);
      console.log(`   Submissions will auto-approve without coach review.`);
    }
  } catch (e) {
    console.error("❌ Error:", (e as Error).message);
    process.exit(1);
  }
}
