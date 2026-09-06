/**
 * Broadcasts — segment-powered outreach. A workspace composes a message (email
 * or SMS, with {{name}}-style merge fields) and sends it to the contacts a
 * segment resolves to. The segment's rule tree is snapshotted at send time so
 * the record is reproducible even if the segment later changes. Per-recipient
 * results are logged in broadcast_sends so the owner sees what went out and
 * what bounced. contact_optouts holds addresses that asked not to be contacted;
 * they're filtered out of every send.
 */
exports.up = (pgm) => {
  pgm.createTable("broadcasts", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    channel: { type: "text", notNull: true }, // 'email' | 'sms'
    subject: { type: "text" },
    body: { type: "text", notNull: true },
    rules: { type: "jsonb", notNull: true },
    segment_id: { type: "text" },
    status: { type: "text", notNull: true, default: "draft" }, // draft | sending | sent
    recipient_count: { type: "integer", notNull: true, default: 0 },
    sent_count: { type: "integer", notNull: true, default: 0 },
    failed_count: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    sent_at: { type: "timestamptz" },
  });
  pgm.createIndex("broadcasts", ["workspace_id", "created_at"]);

  pgm.createTable("broadcast_sends", {
    id: { type: "text", primaryKey: true },
    broadcast_id: { type: "text", notNull: true },
    workspace_id: { type: "text", notNull: true },
    address: { type: "text", notNull: true },
    status: { type: "text", notNull: true }, // sent | failed | skipped
    reason: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("broadcast_sends", ["broadcast_id"]);

  pgm.createTable("contact_optouts", {
    workspace_id: { type: "text", notNull: true },
    channel: { type: "text", notNull: true }, // 'email' | 'sms'
    address: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, { constraints: { primaryKey: ["workspace_id", "channel", "address"] } });
};

exports.down = (pgm) => {
  pgm.dropTable("contact_optouts");
  pgm.dropTable("broadcast_sends");
  pgm.dropTable("broadcasts");
};
