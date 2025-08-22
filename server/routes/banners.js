const express = require('express');
const { getDatabase } = require('../database/init-fixed');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all banners with filtering and pagination
router.get('/', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (title LIKE ? OR description LIKE ? OR text_overlay LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    if (status === 'active') {
      whereClause += ' AND is_active = 1';
      whereClause += ' AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)';
      whereClause += ' AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)';
    } else if (status === 'inactive') {
      whereClause += ' AND is_active = 0';
    } else if (status === 'scheduled') {
      whereClause += ' AND start_date > CURRENT_TIMESTAMP';
    } else if (status === 'expired') {
      whereClause += ' AND end_date < CURRENT_TIMESTAMP';
    }
  }

  const query = `
    SELECT *,
      CASE 
        WHEN is_active = 0 THEN 'inactive'
        WHEN start_date > CURRENT_TIMESTAMP THEN 'scheduled'
        WHEN end_date < CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'active'
      END as status
    FROM banners
    ${whereClause}
    ORDER BY display_order ASC, created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM banners
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.all(query, [...params, limit, offset], (err, banners) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({
        banners,
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

// Get active banners for public display
router.get('/active', (req, res) => {
  const query = `
    SELECT *
    FROM banners
    WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
      AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
    ORDER BY display_order ASC
  `;

  db.all(query, (err, banners) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ banners });
  });
});

// Get single banner
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT *,
      CASE 
        WHEN is_active = 0 THEN 'inactive'
        WHEN start_date > CURRENT_TIMESTAMP THEN 'scheduled'
        WHEN end_date < CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'active'
      END as status
    FROM banners
    WHERE id = ?
  `;

  db.get(query, [req.params.id], (err, banner) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ banner });
  });
});

// Create new banner
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const {
    title, description, image_url, text_overlay, text_position, text_color,
    text_size, background_overlay, overlay_opacity, link_url, link_text,
    is_active, display_order, start_date, end_date
  } = req.body;

  if (!title || !image_url) {
    return res.status(400).json({ error: 'Title and image URL are required' });
  }

  const query = `
    INSERT INTO banners (
      title, description, image_url, text_overlay, text_position, text_color,
      text_size, background_overlay, overlay_opacity, link_url, link_text,
      is_active, display_order, start_date, end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    title, description, image_url, text_overlay, text_position || 'center',
    text_color || '#ffffff', text_size || 'large', background_overlay || 0,
    overlay_opacity || 0.5, link_url, link_text, is_active !== undefined ? is_active : 1,
    display_order || 0, start_date, end_date
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json({
      message: 'Banner created successfully',
      banner: { id: this.lastID, ...req.body }
    });
  });
});

// Update banner
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const {
    title, description, image_url, text_overlay, text_position, text_color,
    text_size, background_overlay, overlay_opacity, link_url, link_text,
    is_active, display_order, start_date, end_date
  } = req.body;

  const query = `
    UPDATE banners SET
      title = ?, description = ?, image_url = ?, text_overlay = ?,
      text_position = ?, text_color = ?, text_size = ?, background_overlay = ?,
      overlay_opacity = ?, link_url = ?, link_text = ?, is_active = ?,
      display_order = ?, start_date = ?, end_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(query, [
    title, description, image_url, text_overlay, text_position,
    text_color, text_size, background_overlay, overlay_opacity,
    link_url, link_text, is_active, display_order, start_date, end_date,
    req.params.id
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ message: 'Banner updated successfully' });
  });
});

// Delete banner
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM banners WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ message: 'Banner deleted successfully' });
  });
});

// Reorder banners
router.put('/reorder', authenticateToken, requireAdmin, (req, res) => {
  const { banners } = req.body; // Array of { id, display_order }

  if (!Array.isArray(banners) || banners.length === 0) {
    return res.status(400).json({ error: 'Banners array is required' });
  }

  const stmt = db.prepare('UPDATE banners SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let completed = 0;
    let hasError = false;

    banners.forEach(banner => {
      stmt.run([banner.display_order, banner.id], function(err) {
        if (err && !hasError) {
          hasError = true;
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to reorder banners' });
        }

        completed++;
        if (completed === banners.length && !hasError) {
          db.run('COMMIT');
          res.json({ message: 'Banners reordered successfully' });
        }
      });
    });

    stmt.finalize();
  });
});

// Toggle banner status
router.put('/:id/toggle', authenticateToken, requireAdmin, (req, res) => {
  const query = 'UPDATE banners SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

  db.run(query, [req.params.id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ message: 'Banner status toggled successfully' });
  });
});

module.exports = router;