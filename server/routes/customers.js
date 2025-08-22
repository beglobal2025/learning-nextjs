const express = require('express');
const { getDatabase } = require('../database/init-fixed');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all customers with pagination and filtering
router.get('/', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    if (status === 'active') {
      whereClause += ' AND is_active = 1';
    } else if (status === 'inactive') {
      whereClause += ' AND is_active = 0';
    } else if (status === 'vip') {
      whereClause += ' AND total_spent > 1000';
    } else if (status === 'new') {
      whereClause += ' AND total_orders <= 1';
    }
  }

  const query = `
    SELECT 
      *,
      CASE 
        WHEN total_spent > 3000 THEN 'vip'
        WHEN total_orders <= 1 THEN 'new'
        WHEN is_active = 1 THEN 'active'
        ELSE 'inactive'
      END as status
    FROM customers
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM customers
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.all(query, [...params, limit, offset], (err, customers) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({
        customers,
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

// Get single customer with orders
router.get('/:id', authenticateToken, (req, res) => {
  const customerQuery = 'SELECT * FROM customers WHERE id = ?';
  const ordersQuery = `
    SELECT id, order_number, status, payment_status, total_amount, created_at
    FROM orders 
    WHERE customer_id = ? 
    ORDER BY created_at DESC 
    LIMIT 10
  `;
  const addressesQuery = 'SELECT * FROM customer_addresses WHERE customer_id = ?';

  db.get(customerQuery, [req.params.id], (err, customer) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    db.all(ordersQuery, [req.params.id], (err, orders) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      db.all(addressesQuery, [req.params.id], (err, addresses) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({ 
          customer: { 
            ...customer, 
            recent_orders: orders,
            addresses: addresses
          } 
        });
      });
    });
  });
});

// Create new customer
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const {
    first_name, last_name, email, phone, date_of_birth,
    gender, avatar_url, is_active, email_verified
  } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'First name, last name, and email are required' });
  }

  const query = `
    INSERT INTO customers (
      first_name, last_name, email, phone, date_of_birth,
      gender, avatar_url, is_active, email_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    first_name, last_name, email, phone, date_of_birth,
    gender, avatar_url, is_active !== undefined ? is_active : 1,
    email_verified !== undefined ? email_verified : 0
  ], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json({
      message: 'Customer created successfully',
      customer: { id: this.lastID, ...req.body }
    });
  });
});

// Update customer
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const {
    first_name, last_name, email, phone, date_of_birth,
    gender, avatar_url, is_active, email_verified
  } = req.body;

  const query = `
    UPDATE customers SET
      first_name = ?, last_name = ?, email = ?, phone = ?,
      date_of_birth = ?, gender = ?, avatar_url = ?,
      is_active = ?, email_verified = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(query, [
    first_name, last_name, email, phone, date_of_birth,
    gender, avatar_url, is_active, email_verified, req.params.id
  ], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer updated successfully' });
  });
});

// Delete customer
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  // Check if customer has orders
  db.get('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?', [req.params.id], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (result.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete customer with existing orders. Consider deactivating instead.' 
      });
    }

    db.run('DELETE FROM customers WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json({ message: 'Customer deleted successfully' });
    });
  });
});

// Add customer address
router.post('/:id/addresses', authenticateToken, requireAdmin, (req, res) => {
  const {
    type, first_name, last_name, company, address_line_1,
    address_line_2, city, state, postal_code, country, is_default
  } = req.body;

  if (!first_name || !last_name || !address_line_1 || !city || !state || !postal_code || !country) {
    return res.status(400).json({ error: 'Required address fields are missing' });
  }

  const query = `
    INSERT INTO customer_addresses (
      customer_id, type, first_name, last_name, company,
      address_line_1, address_line_2, city, state, postal_code, country, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    req.params.id, type || 'shipping', first_name, last_name, company,
    address_line_1, address_line_2, city, state, postal_code, country,
    is_default || 0
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json({
      message: 'Address added successfully',
      address: { id: this.lastID, ...req.body }
    });
  });
});

// Get customer statistics
router.get('/stats/overview', authenticateToken, (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM customers',
    active: 'SELECT COUNT(*) as count FROM customers WHERE is_active = 1',
    inactive: 'SELECT COUNT(*) as count FROM customers WHERE is_active = 0',
    new_this_month: `
      SELECT COUNT(*) as count FROM customers 
      WHERE created_at >= date('now', 'start of month')
    `,
    vip: 'SELECT COUNT(*) as count FROM customers WHERE total_spent > 1000',
    avg_order_value: `
      SELECT AVG(total_spent / NULLIF(total_orders, 0)) as avg 
      FROM customers WHERE total_orders > 0
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

      stats[key] = key === 'avg_order_value' ? (result.avg || 0) : result.count;
      completed++;

      if (completed === total) {
        res.json({ stats });
      }
    });
  });
});

module.exports = router;