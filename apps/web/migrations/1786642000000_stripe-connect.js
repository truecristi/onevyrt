/**
 * Stripe Connect: store the connected-account id a workspace uses to collect
 * payments from ITS OWN customers (distinct from stripe_customer_id, which is
 * the workspace's customer record for paying for OneVYRT itself). We only ever
 * store the account id — never card data.
 */
exports.up = (pgm) => {
  pgm.addColumn("workspaces", {
    stripe_connect_account_id: { type: "text" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("workspaces", "stripe_connect_account_id");
};
