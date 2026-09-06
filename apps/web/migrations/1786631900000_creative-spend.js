/**
 * Per-creative ad spend, so cost-per-qualified-lead can be shown for each
 * creative (and rolled up per angle). The owner enters what they spent on each
 * ad in Meta; CAC = spend ÷ the qualified leads that creative's tracked link
 * produced. Defaults to 0 (unknown) so existing creatives are unaffected.
 */
exports.up = (pgm) => {
  pgm.addColumn("creatives", { spend: { type: "numeric", notNull: true, default: 0 } });
};

exports.down = (pgm) => {
  pgm.dropColumn("creatives", "spend");
};
