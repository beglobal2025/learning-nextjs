const express = require('express');
const { getDatabase } = require('../database/init-fixed');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all orders with pagination and filtering
router.get('/', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const payment_status = req.query.payment_status || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (o.order_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status && status !== 'all') {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }

  if (payment_status && payment_status !== 'all') {
    whereClause += ' AND o.payment_status = ?';
    params.push(payment_status);
  }

  const query = `
    SELECT 
      o.*,
      c.first_name || ' ' || c.last_name as customer_name,
      c.email as customer_email,
      COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ${whereClause}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT o.id) as total
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.all(query, [...params, limit, offset], (err, orders) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({
        orders,
        pagination: {
          page,
          limit,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Get single order with items
router.get('/:id', authenticateToken, (req, res) => {
  const orderQuery = `
    SELECT 
      o.*,
      c.first_name || ' ' || c.last_name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `;

  const itemsQuery = `
    SELECT 
      oi.*,
      p.image_url as product_image
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `;

  db.get(orderQuery, [req.params.id], (err, order) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    db.all(itemsQuery, [req.params.id], (err, items) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // Parse JSON fields
      if (order.shipping_address) {
        try {
          order.shipping_address = JSON.parse(order.shipping_address);
        } catch (e) {
          order.shipping_address = null;
        }
      }

      if (order.billing_address) {
        try {
          order.billing_address = JSON.parse(order.billing_address);
        } catch (e) {
          order.billing_address = null;
        }
      }

      res.json({ order: { ...order, items } });
    });
  });
});

// Create new order
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const {
    customer_id, items, shipping_address, billing_address,
    payment_method, notes, shipping_amount, tax_amount, discount_amount
  } = req.body;

  if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer ID and items are required' });
  }

  // Generate order number
  const orderNumber = 'ORD-' + Date.now().toString().slice(-6);

  // Calculate totals
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.quantity * item.unit_price;
  });

  const totalAmount = subtotal + (tax_amount || 0) + (shipping_amount || 0) - (discount_amount || 0);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Insert order
    const orderQuery = `
      INSERT INTO orders (
        order_number, customer_id, status, payment_status, payment_method,
        subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
        shipping_address, billing_address, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(orderQuery, [
      orderNumber, customer_id, 'pending', 'pending', payment_method,
      subtotal, tax_amount || 0, shipping_amount || 0, discount_amount || 0, totalAmount,
      shipping_address ? JSON.stringify(shipping_address) : null,
      billing_address ? JSON.stringify(billing_address) : null,
      notes
    ], function(err) {
      if (err) {
        db.run('ROLLBACK');
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create order' });
      }

      const orderId = this.lastID;

      // Insert order items
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      let itemsInserted = 0;
      let hasError = false;

      items.forEach(item => {
        const totalPrice = item.quantity * item.unit_price;
        
        db.run(itemQuery, [
          orderId, item.product_id, item.product_name, item.product_sku,
          item.quantity, item.unit_price, totalPrice
        ], function(err) {
          if (err && !hasError) {
            hasError = true;
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to create order items' });
          }

          itemsInserted++;
          if (itemsInserted === items.length && !hasError) {
            db.run('COMMIT');
            res.status(201).json({
              message: 'Order created successfully',
              order: { id: orderId, order_number: orderNumber }
            });
          }
        });
      });
    });
  });
});

// Update order status
router.put('/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const { status, payment_status, tracking_number, notes } = req.body;

  let updateFields = [];
  let params = [];

  if (status) {
    updateFields.push('status = ?');
    params.push(status);

    // Set shipped_at when status changes to shipped
    if (status === 'shipped') {
      updateFields.push('shipped_at = CURRENT_TIMESTAMP');
    }
    // Set delivered_at when status changes to delivered
    if (status === 'delivered') {
      updateFields.push('delivered_at = CURRENT_TIMESTAMP');
    }
  }

  if (payment_status) {
    updateFields.push('payment_status = ?');
    params.push(payment_status);
  }

  if (tracking_number) {
    updateFields.push('tracking_number = ?');
    params.push(tracking_number);
  }

  if (notes) {
    updateFields.push('notes = ?');
    params.push(notes);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  const query = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order updated successfully' });
  });
});

// Delete order
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Delete order items first (due to foreign key constraint)
    db.run('DELETE FROM order_items WHERE order_id = ?', [req.params.id], function(err) {
      if (err) {
        db.run('ROLLBACK');
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // Delete order
      db.run('DELETE FROM orders WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Order not found' });
        }

        db.run('COMMIT');
        res.json({ message: 'Order deleted successfully' });
      });
    });
  });
});

// Get order statistics
router.get('/stats/overview', authenticateToken, (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM orders',
    pending: 'SELECT COUNT(*) as count FROM orders WHERE status = "pending"',
    processing: 'SELECT COUNT(*) as count FROM orders WHERE status = "processing"',
    shipped: 'SELECT COUNT(*) as count FROM orders WHERE status = "shipped"',
    delivered: 'SELECT COUNT(*) as count FROM orders WHERE status = "delivered"',
    cancelled: 'SELECT COUNT(*) as count FROM orders WHERE status = "cancelled"',
    revenue: 'SELECT SUM(total_amount) as total FROM orders WHERE payment_status = "paid"'
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

      stats[key] = key === 'revenue' ? (result.total || 0) : result.count;
      completed++;

      if (completed === total) {
        res.json({ stats });
      }
    });
  });
});

module.exports = router;