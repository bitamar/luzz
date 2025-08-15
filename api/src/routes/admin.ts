import { Router } from 'express';
import { getDbClient } from '../db';
import { requireUser, requireAdmin } from '../middleware/auth';
import type { BookingStatsRow, PopularStudioRow } from '../types';

const router = Router();

// Admin guard for all admin routes
router.use(requireUser());
router.use(requireAdmin());

// GET /admin/metrics - Basic system metrics
router.get('/metrics', async (req, res) => {
  try {
    const client = getDbClient();

    // Get basic counts
    const [
      studiosResult,
      customersResult,
      childrenResult,
      slotsResult,
      bookingsResult,
      invitesResult,
    ] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM studios'),
      client.query('SELECT COUNT(*) as count FROM customers'),
      client.query('SELECT COUNT(*) as count FROM children'),
      client.query('SELECT COUNT(*) as count FROM slots WHERE active = true'),
      client.query('SELECT COUNT(*) as count FROM bookings'),
      client.query('SELECT COUNT(*) as count FROM invites WHERE expires_at > NOW()'),
    ]);

    // Get booking metrics
    const bookingStatsResult = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(CASE WHEN paid = true THEN 1 ELSE 0 END) as paid_count
      FROM bookings 
      GROUP BY status
    `);

    // Get revenue metrics (last 30 days)
    const revenueResult = await client.query(`
      SELECT 
        SUM(s.price) as total_revenue,
        COUNT(b.id) as paid_bookings
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE b.paid = true 
        AND b.paid_at >= NOW() - INTERVAL '30 days'
    `);

    // Get most popular studios
    const popularStudiosResult = await client.query(`
      SELECT 
        st.name,
        st.slug,
        COUNT(b.id) as booking_count
      FROM studios st
      LEFT JOIN slots s ON st.id = s.studio_id
      LEFT JOIN bookings b ON s.id = b.slot_id
      GROUP BY st.id, st.name, st.slug
      ORDER BY booking_count DESC
      LIMIT 5
    `);

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',

      // Database counts
      counts: {
        studios: parseInt(studiosResult.rows[0].count),
        customers: parseInt(customersResult.rows[0].count),
        children: parseInt(childrenResult.rows[0].count),
        active_slots: parseInt(slotsResult.rows[0].count),
        bookings: parseInt(bookingsResult.rows[0].count),
        active_invites: parseInt(invitesResult.rows[0].count),
      },

      // Booking statistics
      booking_stats: bookingStatsResult.rows.map((row: BookingStatsRow) => ({
        status: row.status,
        count: parseInt(row.count),
        paid_count: parseInt(row.paid_count),
      })),

      // Revenue (last 30 days)
      revenue_last_30_days: {
        total: parseFloat(revenueResult.rows[0].total_revenue || '0'),
        paid_bookings: parseInt(revenueResult.rows[0].paid_bookings || '0'),
      },

      // Popular studios
      popular_studios: popularStudiosResult.rows.map((row: PopularStudioRow) => ({
        name: row.name,
        slug: row.slug,
        booking_count: parseInt(row.booking_count),
      })),
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/health - Detailed health check
router.get('/health', async (req, res) => {
  try {
    const client = getDbClient();
    const start = Date.now();

    // Test database connection
    await client.query('SELECT 1');
    const dbLatency = Date.now() - start;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),

      services: {
        database: {
          status: 'healthy',
          latency_ms: dbLatency,
        },
        api: {
          status: 'healthy',
          version: '1.0.0',
        },
      },

      environment: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development',
      },
    };

    res.json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// GET /admin/database/status - Database-specific status
router.get('/database/status', async (req, res) => {
  try {
    const client = getDbClient();

    // Get database size and connection info
    const [sizeResult, connectionsResult] = await Promise.all([
      client.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as size,
          current_database() as name
      `),
      client.query(`
        SELECT 
          count(*) as active_connections,
          max_conn.setting as max_connections
        FROM pg_stat_activity, 
             (SELECT setting FROM pg_settings WHERE name = 'max_connections') max_conn
        WHERE state = 'active'
        GROUP BY max_conn.setting
      `),
    ]);

    // Get table sizes
    const tableSizesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    const dbStatus = {
      database: sizeResult.rows[0],
      connections: connectionsResult.rows[0] || {
        active_connections: 0,
        max_connections: 'unknown',
      },
      tables: tableSizesResult.rows,
      timestamp: new Date().toISOString(),
    };

    res.json(dbStatus);
  } catch (error) {
    console.error('Error fetching database status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
