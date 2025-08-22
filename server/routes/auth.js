const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init-fixed');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get(
    'SELECT * FROM admin_users WHERE email = ?',
    [email],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error('Password comparison error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user);
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
          message: 'Login successful',
          token,
          user: userWithoutPassword
        });
      });
    }
  );
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, email, role, created_at FROM admin_users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    }
  );
});

// Change password
router.put('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  db.get(
    'SELECT password FROM admin_users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      bcrypt.compare(currentPassword, user.password, (err, isMatch) => {
        if (err) {
          console.error('Password comparison error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!isMatch) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
          if (err) {
            console.error('Password hashing error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          db.run(
            'UPDATE admin_users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, req.user.id],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
              }

              res.json({ message: 'Password changed successfully' });
            }
          );
        });
      });
    }
  );
});

module.exports = router;