const express = require('express');
const { getDatabase } = require('../database/init-fixed');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all categories with hierarchy
router.get('/', authenticateToken, (req, res) => {
  const includeSubcategories = req.query.include_subcategories !== 'false';
  
  if (includeSubcategories) {
    // Get categories with their subcategories
    const query = `
      SELECT 
        c.*,
        COUNT(p.id) as product_count,
        parent.name as parent_name
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      LEFT JOIN categories parent ON c.parent_id = parent.id
      GROUP BY c.id
      ORDER BY c.parent_id IS NULL DESC, c.sort_order, c.name
    `;

    db.all(query, (err, categories) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // Organize categories into hierarchy
      const categoryMap = new Map();
      const rootCategories = [];

      categories.forEach(category => {
        categoryMap.set(category.id, { ...category, subcategories: [] });
        if (!category.parent_id) {
          rootCategories.push(categoryMap.get(category.id));
        }
      });

      categories.forEach(category => {
        if (category.parent_id) {
          const parent = categoryMap.get(category.parent_id);
          if (parent) {
            parent.subcategories.push(categoryMap.get(category.id));
          }
        }
      });

      res.json({ categories: rootCategories, flat_categories: categories });
    });
  } else {
    // Get only parent categories
    const query = `
      SELECT 
        c.*,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      WHERE c.parent_id IS NULL
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `;

    db.all(query, (err, categories) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ categories });
    });
  }
});

// Get subcategories for a specific parent category
router.get('/:id/subcategories', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      c.*,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
    WHERE c.parent_id = ?
    GROUP BY c.id
    ORDER BY c.sort_order, c.name
  `;

  db.all(query, [req.params.id], (err, subcategories) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ subcategories });
  });
});

// Get single category with details
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      c.*,
      COUNT(p.id) as product_count,
      parent.name as parent_name,
      parent.id as parent_id
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
    LEFT JOIN categories parent ON c.parent_id = parent.id
    WHERE c.id = ?
    GROUP BY c.id
  `;

  db.get(query, [req.params.id], (err, category) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get subcategories if this is a parent category
    const subcategoriesQuery = `
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      WHERE c.parent_id = ?
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `;

    db.all(subcategoriesQuery, [req.params.id], (err, subcategories) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ category: { ...category, subcategories } });
    });
  });
});

// Create new category
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, slug, image_url, parent_id, is_active, sort_order } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Category name and slug are required' });
  }

  const query = `
    INSERT INTO categories (name, description, slug, image_url, parent_id, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    name, 
    description, 
    slug, 
    image_url, 
    parent_id || null, 
    is_active !== undefined ? is_active : 1,
    sort_order || 0
  ], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Category name or slug already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json({
      message: 'Category created successfully',
      category: { id: this.lastID, ...req.body }
    });
  });
});

// Update category
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, slug, image_url, parent_id, is_active, sort_order } = req.body;

  // Prevent circular references
  if (parent_id && parseInt(parent_id) === parseInt(req.params.id)) {
    return res.status(400).json({ error: 'Category cannot be its own parent' });
  }

  const query = `
    UPDATE categories SET
      name = ?, description = ?, slug = ?, image_url = ?, 
      parent_id = ?, is_active = ?, sort_order = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(query, [
    name, description, slug, image_url, 
    parent_id || null, is_active, sort_order || 0,
    req.params.id
  ], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Category name or slug already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category updated successfully' });
  });
});

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  // Check if category has products
  db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [req.params.id], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (result.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing products. Move products to another category first.' 
      });
    }

    // Check if category has subcategories
    db.get('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?', [req.params.id], (err, subcatResult) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (subcatResult.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete category with subcategories. Delete subcategories first.' 
        });
      }

      db.run('DELETE FROM categories WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
      });
    });
  });
});

// Reorder categories
router.put('/reorder', authenticateToken, requireAdmin, (req, res) => {
  const { categories } = req.body; // Array of { id, sort_order }

  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: 'Categories array is required' });
  }

  const stmt = db.prepare('UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let completed = 0;
    let hasError = false;

    categories.forEach(category => {
      stmt.run([category.sort_order, category.id], function(err) {
        if (err && !hasError) {
          hasError = true;
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to reorder categories' });
        }

        completed++;
        if (completed === categories.length && !hasError) {
          db.run('COMMIT');
          res.json({ message: 'Categories reordered successfully' });
        }
      });
    });

    stmt.finalize();
  });
});

module.exports = router;