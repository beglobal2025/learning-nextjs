const express = require('express');
const { getDatabase } = require('../database/init-fixed');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Dashboard overview stats
router.get('/dashboard', authenticateToken, (req, res) => {
  const queries = {
    totalRevenue: `
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM orders 
      WHERE payment_status = 'paid'
    `,
    totalOrders: 'SELECT COUNT(*) as total FROM orders',
    totalProducts: 'SELECT COUNT(*) as total FROM products WHERE is_active = 1',
    totalCustomers: 'SELECT COUNT(*) as total FROM customers WHERE is_active = 1',
    revenueGrowth: `
      SELECT 
        COALESCE(SUM(CASE WHEN created_at >= date('now', 'start of month') THEN total_amount ELSE 0 END), 0) as current_month,
        COALESCE(SUM(CASE WHEN created_at >= date('now', 'start of month', '-1 month') AND created_at < date('now', 'start of month') THEN total_amount ELSE 0 END), 0) as last_month
      FROM orders 
      WHERE payment_status = 'paid'
    `,
    ordersGrowth: `
      SELECT 
        COUNT(CASE WHEN created_at >= date('now', 'start of month') THEN 1 END) as current_month,
        COUNT(CASE WHEN created_at >= date('now', 'start of month', '-1 month') AND created_at < date('now', 'start of month') THEN 1 END) as last_month
      FROM orders
    `,
    lowStockProducts: `
      SELECT COUNT(*) as total 
      FROM products 
      WHERE stock_quantity <= low_stock_threshold AND is_active = 1
    `,
    pendingOrders: `
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE status = 'pending'
    `
  };

  const stats = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (key === 'revenueGrowth') {
        const current = result.current_month || 0;
        const last = result.last_month || 0;
        const growth = last > 0 ? ((current - last) / last * 100).toFixed(1) : 0;
        stats.revenueGrowth = parseFloat(growth);
      } else if (key === 'ordersGrowth') {
        const current = result.current_month || 0;
        const last = result.last_month || 0;
        const growth = last > 0 ? ((current - last) / last * 100).toFixed(1) : 0;
        stats.ordersGrowth = parseFloat(growth);
      } else {
        stats[key] = result.total || 0;
      }

      completed++;
      if (completed === total) {
        res.json({ stats });
      }
    });
  });
});

// Revenue chart data (last 6 months)
router.get('/revenue-chart', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      strftime('%Y-%m', created_at) as month,
      strftime('%m', created_at) as month_num,
      CASE strftime('%m', created_at)
        WHEN '01' THEN 'Jan'
        WHEN '02' THEN 'Feb'
        WHEN '03' THEN 'Mar'
        WHEN '04' THEN 'Apr'
        WHEN '05' THEN 'May'
        WHEN '06' THEN 'Jun'
        WHEN '07' THEN 'Jul'
        WHEN '08' THEN 'Aug'
        WHEN '09' THEN 'Sep'
        WHEN '10' THEN 'Oct'
        WHEN '11' THEN 'Nov'
        WHEN '12' THEN 'Dec'
      END as month_name,
      COALESCE(SUM(total_amount), 0) as revenue,
      COUNT(*) as orders
    FROM orders 
    WHERE payment_status = 'paid' 
      AND created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month
  `;

  db.all(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const chartData = results.map(row => ({
      month: row.month_name,
      revenue: parseFloat(row.revenue),
      orders: row.orders
    }));

    res.json({ chartData });
  });
});

// Top selling products
router.get('/top-products', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      p.name,
      p.image_url,
      SUM(oi.quantity) as total_sold,
      SUM(oi.total_price) as revenue,
      COUNT(DISTINCT oi.order_id) as order_count
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.payment_status = 'paid'
    GROUP BY p.id, p.name
    ORDER BY total_sold DESC
    LIMIT 10
  `;

  db.all(query, (err, products) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Calculate percentage based on top seller
    const maxSold = products.length > 0 ? products[0].total_sold : 1;
    const topProducts = products.map(product => ({
      ...product,
      percentage: Math.round((product.total_sold / maxSold) * 100),
      revenue: parseFloat(product.revenue)
    }));

    res.json({ topProducts });
  });
});

// Recent orders for dashboard
router.get('/recent-orders', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      o.id,
      o.order_number,
      o.status,
      o.total_amount,
      o.created_at,
      c.first_name || ' ' || c.last_name as customer_name,
      datetime(o.created_at, 'localtime') as formatted_time
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ORDER BY o.created_at DESC
    LIMIT 5
  `;

  db.all(query, (err, orders) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const recentOrders = orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount),
      time_ago: getTimeAgo(new Date(order.created_at))
    }));

    res.json({ recentOrders });
  });
});

// Order status distribution
router.get('/order-status', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      status,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 1) as percentage
    FROM orders
    GROUP BY status
    ORDER BY count DESC
  `;

  db.all(query, (err, statusData) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ statusData });
  });
});

// Customer growth over time
router.get('/customer-growth', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      strftime('%Y-%m', created_at) as month,
      CASE strftime('%m', created_at)
        WHEN '01' THEN 'Jan'
        WHEN '02' THEN 'Feb'
        WHEN '03' THEN 'Mar'
        WHEN '04' THEN 'Apr'
        WHEN '05' THEN 'May'
        WHEN '06' THEN 'Jun'
        WHEN '07' THEN 'Jul'
        WHEN '08' THEN 'Aug'
        WHEN '09' THEN 'Sep'
        WHEN '10' THEN 'Oct'
        WHEN '11' THEN 'Nov'
        WHEN '12' THEN 'Dec'
      END as month_name,
      COUNT(*) as new_customers
    FROM customers 
    WHERE created_at >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month
  `;

  db.all(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const growthData = results.map(row => ({
      month: row.month_name,
      customers: row.new_customers
    }));

    res.json({ growthData });
  });
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

module.exports = router;