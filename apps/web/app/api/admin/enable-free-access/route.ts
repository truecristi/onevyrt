import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { pgPool } from '@/lib/db';

/**
 * POST /api/admin/enable-free-access
 * Enable free-access mode for a workspace by name pattern.
 *
 * Only admins can use this endpoint.
 *
 * Request: { query: string (workspace name or ID) }
 * Response: { id, name, freeAccessMode, message }
 */
export async function POST(req: NextRequest) {
  try {
    // Was an inline `ADMIN_EMAILS.split(',')` check, unlike every other
    // admin/* route's shared requireAdmin() (lib/admin.ts): split only on
    // commas (not the canonical `[,\s]+`, so a space-separated ADMIN_EMAILS
    // value would silently match nothing) and compared case-sensitively (so
    // a real admin whose stored email casing differs from ADMIN_EMAILS's
    // casing would be wrongly denied). Both divergences were fail-closed
    // (deny, not wrongly allow), but still an inconsistency worth closing —
    // flagged during the 2026-09-03 CSRF audit, see docs/CSRF_ROUTE_AUDIT.md.
    const user = await requireAdmin(req.headers.get('cookie'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query must be a non-empty string' },
        { status: 400 }
      );
    }

    const pool = pgPool();

    // Try matching by ID first, then by name pattern
    let result = await pool.query(
      'SELECT id, name, free_access_mode FROM workspaces WHERE id = $1',
      [query]
    );

    if (!result.rows.length) {
      result = await pool.query(
        'SELECT id, name, free_access_mode FROM workspaces WHERE lower(name) LIKE lower($1)',
        [`%${query}%`]
      );
    }

    if (!result.rows.length) {
      return NextResponse.json(
        { error: `No workspace found matching: ${query}` },
        { status: 404 }
      );
    }

    if (result.rows.length > 1) {
      return NextResponse.json(
        {
          error: 'Multiple workspaces found',
          matches: result.rows.map(r => ({ id: r.id, name: r.name })),
        },
        { status: 400 }
      );
    }

    const [workspace] = result.rows;

    if (workspace.free_access_mode) {
      return NextResponse.json({
        id: workspace.id,
        name: workspace.name,
        freeAccessMode: true,
        message: 'Workspace already has free-access mode enabled',
      });
    }

    // Enable free-access mode
    await pool.query(
      'UPDATE workspaces SET free_access_mode = true WHERE id = $1',
      [workspace.id]
    );

    // Log this action
    await pool.query(
      `INSERT INTO activity_log (workspace_id, user_id, action, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        workspace.id,
        user.id,
        'workspace_free_access_mode_enabled',
        JSON.stringify({
          enabled: true,
          timestamp: new Date().toISOString(),
          adminEmail: user.email,
        }),
      ]
    );

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      freeAccessMode: true,
      message: 'Free-access mode enabled successfully. All lessons are now unlocked.',
    });
  } catch (error) {
    console.error('Error enabling free-access mode:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
