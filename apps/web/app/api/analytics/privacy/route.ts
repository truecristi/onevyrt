/**
 * Privacy settings API
 * Manages user privacy preferences for analytics tracking
 */

import { currentUser } from "@/lib/auth";
import { pgPool } from "@/lib/db";

export interface PrivacySettings {
  doNotTrack: boolean;
  trackingConsent: boolean;
  analyticsEnabled: boolean;
  marketingEmails: boolean;
  productEmails: boolean;
  gdprAcknowledged: boolean;
  dataRetentionDays: number;
}

export async function GET(request: Request) {
  const user = await currentUser(request.headers.get("cookie"));

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await pgPool().query<any>(
      `SELECT
        do_not_track as "doNotTrack",
        tracking_consent as "trackingConsent",
        analytics_enabled as "analyticsEnabled",
        marketing_emails as "marketingEmails",
        product_emails as "productEmails",
        gdpr_ackowledged as "gdprAcknowledged",
        data_retention_days as "dataRetentionDays"
       FROM privacy_settings WHERE user_id = $1`,
      [user.id]
    );

    if (res.rows.length === 0) {
      // Return defaults if not set
      return new Response(
        JSON.stringify({
          doNotTrack: false,
          trackingConsent: true,
          analyticsEnabled: true,
          marketingEmails: true,
          productEmails: true,
          gdprAcknowledged: false,
          dataRetentionDays: 90,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(res.rows[0]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[privacy] GET error:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch privacy settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT(request: Request) {
  const user = await currentUser(request.headers.get("cookie"));

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await request.json()) as Partial<PrivacySettings>;
    const pool = pgPool();

    // Check if settings exist
    const existing = await pool.query(
      "SELECT user_id FROM privacy_settings WHERE user_id = $1",
      [user.id]
    );

    if (existing.rows.length === 0) {
      // Insert new settings
      await pool.query(
        `INSERT INTO privacy_settings
         (user_id, do_not_track, tracking_consent, analytics_enabled, marketing_emails, product_emails, gdpr_ackowledged, data_retention_days, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
        [
          user.id,
          body.doNotTrack ?? false,
          body.trackingConsent ?? true,
          body.analyticsEnabled ?? true,
          body.marketingEmails ?? true,
          body.productEmails ?? true,
          body.gdprAcknowledged ?? false,
          body.dataRetentionDays ?? 90,
        ]
      );
    } else {
      // Update existing settings
      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (body.doNotTrack !== undefined) {
        updates.push(`do_not_track = $${paramIdx++}`);
        params.push(body.doNotTrack);
      }
      if (body.trackingConsent !== undefined) {
        updates.push(`tracking_consent = $${paramIdx++}`);
        params.push(body.trackingConsent);
      }
      if (body.analyticsEnabled !== undefined) {
        updates.push(`analytics_enabled = $${paramIdx++}`);
        params.push(body.analyticsEnabled);
      }
      if (body.marketingEmails !== undefined) {
        updates.push(`marketing_emails = $${paramIdx++}`);
        params.push(body.marketingEmails);
      }
      if (body.productEmails !== undefined) {
        updates.push(`product_emails = $${paramIdx++}`);
        params.push(body.productEmails);
      }
      if (body.gdprAcknowledged !== undefined) {
        updates.push(`gdpr_ackowledged = $${paramIdx++}`);
        params.push(body.gdprAcknowledged);
      }
      if (body.dataRetentionDays !== undefined) {
        updates.push(`data_retention_days = $${paramIdx++}`);
        params.push(body.dataRetentionDays);
      }

      updates.push(`updated_at = now()`);
      params.push(user.id);

      if (updates.length > 1) {
        await pool.query(
          `UPDATE privacy_settings SET ${updates.join(", ")} WHERE user_id = $${paramIdx}`,
          params
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[privacy] PUT error:", e);
    return new Response(JSON.stringify({ error: "Failed to update privacy settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Purge analytics data for a user (GDPR right to be forgotten)
 */
export async function DELETE(request: Request) {
  const user = await currentUser(request.headers.get("cookie"));

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const pool = pgPool();

    // Purge all analytics data for this user
    await Promise.all([
      pool.query("DELETE FROM page_views WHERE user_id = $1", [user.id]),
      pool.query("DELETE FROM user_actions WHERE user_id = $1", [user.id]),
      pool.query("DELETE FROM conversion_events WHERE user_id = $1", [user.id]),
      pool.query("DELETE FROM analytics_errors WHERE user_id = $1", [user.id]),
      pool.query("DELETE FROM performance_metrics WHERE user_id = $1", [user.id]),
    ]);

    return new Response(JSON.stringify({ success: true, message: "Analytics data purged" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[privacy] DELETE error:", e);
    return new Response(JSON.stringify({ error: "Failed to purge analytics data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
