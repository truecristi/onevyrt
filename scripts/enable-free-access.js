#!/usr/bin/env node
/**
 * Admin script to enable free-access mode for a workspace by ID or name pattern.
 * Usage: node scripts/enable-free-access.js <workspace-id-or-name>
 */

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  if (!process.argv[2]) {
    console.error("Usage: node scripts/enable-free-access.js <workspace-id-or-name>");
    process.exit(1);
  }

  const query = process.argv[2];
  console.log(`Looking for workspace: ${query}`);

  try {
    await client.connect();

    // Try matching by ID first, then by name pattern
    let res = await client.query(
      'SELECT id, name, free_access_mode FROM workspaces WHERE id = $1',
      [query]
    );

    if (!res.rows.length) {
      res = await client.query(
        'SELECT id, name, free_access_mode FROM workspaces WHERE lower(name) LIKE lower($1)',
        [`%${query}%`]
      );
    }

    if (!res.rows.length) {
      console.error(`No workspace found matching: ${query}`);
      process.exit(1);
    }

    if (res.rows.length > 1) {
      console.error("Multiple workspaces found:");
      res.rows.forEach((row) => {
        console.error(`  - ${row.id}: ${row.name} (free_access_mode: ${row.free_access_mode})`);
      });
      console.error("\nPlease be more specific.");
      process.exit(1);
    }

    const [ws] = res.rows;
    if (ws.free_access_mode) {
      console.log(`✓ Workspace "${ws.name}" already has free-access mode enabled.`);
    } else {
      console.log(`Enabling free-access mode for workspace: "${ws.name}" (${ws.id})`);
      await client.query(
        "UPDATE workspaces SET free_access_mode = true WHERE id = $1",
        [ws.id]
      );
      console.log("✓ Free-access mode enabled successfully.");
    }
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
