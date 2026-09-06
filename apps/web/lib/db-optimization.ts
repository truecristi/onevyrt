/**
 * Database Query Optimization Strategies
 *
 * Performance optimization techniques for PostgreSQL queries,
 * connection pooling, caching, and data fetching patterns.
 */

/**
 * Query optimization patterns
 */
export const queryOptimizationPatterns = {
  // Pattern 1: Use indexes for frequently filtered columns
  indexRecommendations: [
    {
      table: 'users',
      columns: ['email', 'created_at', 'deleted_at'],
      reason: 'Frequent login queries and soft-delete filtering',
    },
    {
      table: 'projects',
      columns: ['workspace_id', 'type', 'deleted_at', 'created_at'],
      reason: 'Main query filters for project listing and filtering',
    },
    {
      table: 'enrollments',
      columns: ['workspace_id', 'last_modified_at'],
      reason: 'Enrollment state lookups and audit trails',
    },
    {
      table: 'activity_log',
      columns: ['workspace_id', 'user_id', 'created_at'],
      reason: 'Activity filtering and date range queries',
    },
  ],

  // Pattern 2: Avoid N+1 queries
  example_nplus1: `
    // SLOW: N+1 query problem
    const workspaces = await db.query('SELECT * FROM workspaces WHERE owner_id = $1', [userId]);
    for (const ws of workspaces) {
      const projects = await db.query('SELECT * FROM projects WHERE workspace_id = $1', [ws.id]);
      // Result: 1 + N queries
    }

    // FAST: Single query with JOIN
    const workspacesWithProjects = await db.query(\`
      SELECT w.*, json_agg(p.*) as projects
      FROM workspaces w
      LEFT JOIN projects p ON p.workspace_id = w.id
      WHERE w.owner_id = $1 AND w.deleted_at IS NULL
      GROUP BY w.id
    \`, [userId]);
    // Result: 1 query
  `,

  // Pattern 3: Pagination for large result sets
  pagination_example: `
    // Efficient pagination with cursor
    const cursor = req.query.cursor || 0;
    const limit = 50;

    const items = await db.query(\`
      SELECT * FROM projects
      WHERE workspace_id = $1 AND id > $2
      ORDER BY id
      LIMIT $3
    \`, [workspaceId, cursor, limit]);

    const nextCursor = items.length === limit ? items[items.length - 1].id : null;
  `,

  // Pattern 4: Query result caching
  caching_example: `
    // Cache frequently accessed data (enrollment state)
    const cacheKey = \`enrollment:\${workspaceId}\`;
    let enrollment = cache.get(cacheKey);

    if (!enrollment) {
      enrollment = await db.query(
        'SELECT enrollment FROM enrollments WHERE workspace_id = $1',
        [workspaceId]
      );
      cache.set(cacheKey, enrollment, { ttl: 5 * 60 }); // 5 minute TTL
    }

    return enrollment;
  `,
};

/**
 * Connection pool configuration
 * Optimize for concurrent requests without exhausting connections
 */
export const connectionPoolConfig = {
  max: 20, // Max connections (Fly.io limit consideration)
  min: 5, // Minimum idle connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Connection attempt timeout
  statement_timeout: '30s', // Query timeout
  application_name: 'onevyrt',
};

/**
 * Common query patterns to optimize
 */
export const queryPatterns = {
  // Pattern: Soft-delete filtering
  softDeleteFilter: `
    -- Always include in WHERE clause
    WHERE deleted_at IS NULL AND workspace_id = $1
  `,

  // Pattern: Advisory lock for concurrency control (already in use)
  advisoryLock: `
    SELECT pg_advisory_lock($1);
    BEGIN;
    -- Read/modify/write enrollment
    COMMIT;
    SELECT pg_advisory_unlock($1);
  `,

  // Pattern: JSONB indexing for fast queries on JSON data
  jsonbOptimization: `
    -- Create GIN index for JSONB queries
    CREATE INDEX idx_enrollments_data ON enrollments USING gin(enrollment);

    -- Use @> (contains) operator for fast queries
    SELECT * FROM enrollments
    WHERE enrollment @> '{status: "active"}'::jsonb;
  `,

  // Pattern: Prepared statements to prevent SQL injection + improve performance
  preparedStatements: `
    const stmt = await db.client.prepare(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL'
    );
    const result = await stmt.execute([email]);
  `,
};

/**
 * Performance monitoring queries
 */
export const performanceMonitoring = {
  // Identify slow queries
  slowQueryLog: `
    SELECT
      query,
      calls,
      mean_exec_time,
      max_exec_time
    FROM pg_stat_statements
    WHERE mean_exec_time > 100  -- queries averaging > 100ms
    ORDER BY mean_exec_time DESC
    LIMIT 10;
  `,

  // Check table sizes and unused indexes
  tableAndIndexAnalysis: `
    -- Table sizes
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

    -- Unused indexes
    SELECT
      schemaname,
      tablename,
      indexname,
      idx_scan
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND indexname NOT LIKE 'pg_toast%'
    ORDER BY pg_relation_size(indexrelid) DESC;
  `,

  // Check cache hit ratio
  cacheHitRatio: `
    SELECT
      sum(heap_blks_read) as heap_read,
      sum(heap_blks_hit) as heap_hit,
      sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
    FROM pg_statio_user_tables;
    -- Should be > 0.99 (99% cache hit rate)
  `,

  // Connection pool monitoring
  connectionMonitoring: `
    SELECT
      datname,
      count(*) as connections,
      max_conn
    FROM pg_stat_activity
    CROSS JOIN (SELECT setting::int as max_conn FROM pg_settings WHERE name='max_connections') s
    WHERE datname = 'onevyrt'
    GROUP BY datname, max_conn;
  `,
};

/**
 * Data fetching optimization strategies
 */
export const dataFetchingStrategies = {
  // Strategy 1: Selective column fetching
  selectiveColumns: `
    -- SLOW: Fetch all columns
    SELECT * FROM projects WHERE workspace_id = $1;

    -- FAST: Fetch only needed columns
    SELECT id, slug, name, type FROM projects WHERE workspace_id = $1;
  `,

  // Strategy 2: Batch operations
  batchInsert: `
    // Insert multiple records in one query
    const records = [
      { workspace_id: 1, data: {...} },
      { workspace_id: 1, data: {...} },
    ];

    const values = records
      .map((_, i) => \`($\${i*2+1}, $\${i*2+2})\`)
      .join(',');

    await db.query(
      \`INSERT INTO projects (workspace_id, data) VALUES \${values}\`,
      records.flatMap(r => [r.workspace_id, r.data])
    );
  `,

  // Strategy 3: Prefetching related data
  prefetchData: `
    // Load primary + related data in parallel
    const [user, workspaces, enrollments] = await Promise.all([
      db.query('SELECT * FROM users WHERE id = $1', [userId]),
      db.query('SELECT * FROM workspaces WHERE owner_id = $1', [userId]),
      db.query('SELECT * FROM enrollments WHERE user_id = $1', [userId]),
    ]);
  `,
};

/**
 * Migration checklist for performance
 */
export const performanceOptimizationChecklist = [
  {
    category: 'Indexing',
    items: [
      '- [ ] Add indexes to frequently filtered columns',
      '- [ ] Create composite indexes for multi-column filters',
      '- [ ] Analyze query plans with EXPLAIN ANALYZE',
      '- [ ] Monitor index usage regularly',
    ],
  },
  {
    category: 'Query Optimization',
    items: [
      '- [ ] Eliminate N+1 queries with JOINs',
      '- [ ] Implement pagination for large result sets',
      '- [ ] Use LIMIT and OFFSET efficiently',
      '- [ ] Prefer COUNT(*) with GROUP BY over subqueries',
    ],
  },
  {
    category: 'Caching',
    items: [
      '- [ ] Cache frequently accessed data (enrollment state)',
      '- [ ] Set appropriate TTL values (5-30 minutes)',
      '- [ ] Implement cache invalidation on updates',
      '- [ ] Monitor cache hit ratio',
    ],
  },
  {
    category: 'Connection Management',
    items: [
      '- [ ] Configure connection pool size based on workload',
      '- [ ] Set appropriate idle timeout',
      '- [ ] Monitor active connections',
      '- [ ] Implement connection pooling middleware',
    ],
  },
  {
    category: 'Monitoring',
    items: [
      '- [ ] Enable query logging (log_min_duration_statement)',
      '- [ ] Use pg_stat_statements extension',
      '- [ ] Monitor slow query logs',
      '- [ ] Track cache hit ratios',
    ],
  },
];
