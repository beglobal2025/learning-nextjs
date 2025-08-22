const express = require('express');
const { getDatabase } = require('../database/init-fixed');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all products with pagination and filtering
router.get('/', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const category = req.query.category || '';
  const status = req.query.status || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category && category !== 'all') {
    whereClause += ' AND c.name = ?';
    params.push(category);
  }

  if (status) {
    if (status === 'active') {
      whereClause += ' AND p.is_active = 1 AND p.stock_quantity > 0';
    } else if (status === 'out_of_stock') {
      whereClause += ' AND p.stock_quantity = 0';
    } else if (status === 'low_stock') {
      whereClause += ' AND p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold';
    } else if (status === 'inactive') {
      whereClause += ' AND p.is_active = 0';
    }
  }

  const query = `
    SELECT 
      p.*,
      c.name as category_name,
      parent_c.name as parent_category_name,
      c.parent_id as category_parent_id,
      CASE 
        WHEN p.stock_quantity = 0 THEN 'out_of_stock'
        WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
        WHEN p.is_active = 1 THEN 'active'
        ELSE 'inactive'
      END as status
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories parent_c ON c.parent_id = parent_c.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories parent_c ON c.parent_id = parent_c.id
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.all(query, [...params, limit, offset], (err, products) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({
        products,
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

// Get single product
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      p.*,
      c.name as category_name,
      parent_c.name as parent_category_name,
      c.parent_id as category_parent_id,
      CASE 
        WHEN p.stock_quantity = 0 THEN 'out_of_stock'
        WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
        WHEN p.is_active = 1 THEN 'active'
        ELSE 'inactive'
      END as status
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories parent_c ON c.parent_id = parent_c.id
    WHERE p.id = ?
  `;

  db.get(query, [req.params.id], (err, product) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  });
});

// Create new product
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const {
    name, description, sku, price, cost_price, stock_quantity,
    low_stock_threshold, category_id, image_url, images, weight,
    dimensions, is_active, is_featured, meta_title, meta_description
  } = req.body;

  if (!name || !sku || !price) {
    return res.status(400).json({ error: 'Name, SKU, and price are required' });
  }

  const query = `
    INSERT INTO products (
      name, description, sku, price, cost_price, stock_quantity,
      low_stock_threshold, category_id, image_url, images, weight,
      dimensions, is_active, is_featured, meta_title, meta_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    name, description, sku, price, cost_price || 0, stock_quantity || 0,
    low_stock_threshold || 10, category_id, image_url, 
    images ? JSON.stringify(images) : null,
    weight, dimensions ? JSON.stringify(dimensions) : null,
    is_active !== undefined ? is_active : 1,
    is_featured !== undefined ? is_featured : 0,
    meta_title, meta_description
  ], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'SKU already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json({
      message: 'Product created successfully',
      product: { id: this.lastID, ...req.body }
    });
  });
});

// Update product
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const {
    name, description, sku, price, cost_price, stock_quantity,
    low_stock_threshold, category_id, image_url, images, weight,
    dimensions, is_active, is_featured, meta_title, meta_description
  } = req.body;

  const query = `
    UPDATE products SET
      name = ?, description = ?, sku = ?, price = ?, cost_price = ?,
      stock_quantity = ?, low_stock_threshold = ?, category_id = ?,
      image_url = ?, images = ?, weight = ?, dimensions = ?,
      is_active = ?, is_featured = ?, meta_title = ?, meta_description = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(query, [
    name, description, sku, price, cost_price,
    stock_quantity, low_stock_threshold, category_id,
    image_url, images ? JSON.stringify(images) : null,
    weight, dimensions ? JSON.stringify(dimensions) : null,
    is_active, is_featured, meta_title, meta_description,
    req.params.id
  ], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'SKU already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully' });
  });
});

// Delete product
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  });
});

// Bulk update stock
router.put('/bulk/stock', authenticateToken, requireAdmin, (req, res) => {
  const { updates } = req.body; // Array of { id, stock_quantity }

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'Updates array is required' });
  }

  const stmt = db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let completed = 0;
    let hasError = false;

    updates.forEach(update => {
      stmt.run([update.stock_quantity, update.id], function(err) {
        if (err && !hasError) {
          hasError = true;
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to update stock' });
        }

        completed++;
        if (completed === updates.length && !hasError) {
          db.run('COMMIT');
          res.json({ message: 'Stock updated successfully' });
        }
      });
    });

    stmt.finalize();
  });
});

module.exports = router;