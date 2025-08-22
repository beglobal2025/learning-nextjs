const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const initializeDatabase = () => {
  console.log('🗄️  Initializing SQLite database...');

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.serialize(() => {
    // Admin users table
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Categories table
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        slug TEXT UNIQUE NOT NULL,
        image_url TEXT,
        parent_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories (id)
      )
    `);

    // Products table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        sku TEXT UNIQUE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        cost_price DECIMAL(10,2),
        stock_quantity INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 10,
        category_id INTEGER,
        image_url TEXT,
        images TEXT, -- JSON array of image URLs
        weight DECIMAL(8,2),
        dimensions TEXT, -- JSON object with width, height, depth
        is_active BOOLEAN DEFAULT 1,
        is_featured BOOLEAN DEFAULT 0,
        meta_title TEXT,
        meta_description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      )
    `);

    // Customers table
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        date_of_birth DATE,
        gender TEXT,
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        last_order_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Customer addresses table
    db.run(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        type TEXT DEFAULT 'shipping', -- shipping, billing
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        company TEXT,
        address_line_1 TEXT NOT NULL,
        address_line_2 TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        country TEXT NOT NULL,
        is_default BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
      )
    `);

    // Orders table
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled, refunded
        payment_status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded
        payment_method TEXT,
        subtotal DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        shipping_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        notes TEXT,
        shipping_address TEXT, -- JSON object
        billing_address TEXT, -- JSON object
        tracking_number TEXT,
        shipped_at DATETIME,
        delivered_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )
    `);

    // Order items table
    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_sku TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Insert default categories
    const defaultCategories = [
      { name: 'Electronics', description: 'Electronic devices and gadgets', slug: 'electronics' },
      { name: 'Clothing', description: 'Fashion and apparel', slug: 'clothing' },
      { name: 'Books', description: 'Books and educational materials', slug: 'books' },
      { name: 'Home & Garden', description: 'Home improvement and garden supplies', slug: 'home-garden' },
      { name: 'Sports', description: 'Sports and fitness equipment', slug: 'sports' }
    ];

    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO categories (name, description, slug) VALUES (?, ?, ?)
    `);

    defaultCategories.forEach(category => {
      insertCategory.run(category.name, category.description, category.slug);
    });
    insertCategory.finalize();

    // Insert subcategories after main categories are created
    setTimeout(() => {
      const subcategories = [
        { name: 'Smartphones', description: 'Mobile phones and accessories', slug: 'smartphones', parent_name: 'Electronics' },
        { name: 'Laptops', description: 'Laptops and computers', slug: 'laptops', parent_name: 'Electronics' },
        { name: 'Headphones', description: 'Audio devices and headphones', slug: 'headphones', parent_name: 'Electronics' },
        { name: 'Men\'s Clothing', description: 'Clothing for men', slug: 'mens-clothing', parent_name: 'Clothing' },
        { name: 'Women\'s Clothing', description: 'Clothing for women', slug: 'womens-clothing', parent_name: 'Clothing' },
        { name: 'Fiction', description: 'Fiction books and novels', slug: 'fiction', parent_name: 'Books' },
        { name: 'Non-Fiction', description: 'Non-fiction and educational books', slug: 'non-fiction', parent_name: 'Books' }
      ];

      subcategories.forEach(subcat => {
        db.get('SELECT id FROM categories WHERE name = ?', [subcat.parent_name], (err, parent) => {
          if (!err && parent) {
            db.run(
              'INSERT OR IGNORE INTO categories (name, description, slug, parent_id) VALUES (?, ?, ?, ?)',
              [subcat.name, subcat.description, subcat.slug, parent.id]
            );
          }
        });
      });
    }, 100);

    // Insert sample products
    const sampleProducts = [
      {
        name: 'Wireless Bluetooth Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        sku: 'WH-001',
        price: 299.99,
        cost_price: 150.00,
        stock_quantity: 45,
        category_id: 1,
        image_url: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        name: 'Premium Cotton T-Shirt',
        description: 'Comfortable 100% cotton t-shirt in various colors',
        sku: 'CT-002',
        price: 24.99,
        cost_price: 8.00,
        stock_quantity: 120,
        category_id: 2,
        image_url: 'https://images.pexels.com/photos/428340/pexels-photo-428340.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        name: 'JavaScript Programming Guide',
        description: 'Complete guide to modern JavaScript development',
        sku: 'BK-003',
        price: 39.99,
        cost_price: 15.00,
        stock_quantity: 23,
        category_id: 3,
        image_url: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        name: 'Smart Fitness Watch',
        description: 'Advanced fitness tracking with heart rate monitor',
        sku: 'SW-004',
        price: 199.99,
        cost_price: 80.00,
        stock_quantity: 12,
        category_id: 1,
        image_url: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        name: 'Ceramic Plant Pot',
        description: 'Beautiful ceramic pot perfect for indoor plants',
        sku: 'PP-005',
        price: 15.99,
        cost_price: 5.00,
        stock_quantity: 78,
        category_id: 4,
        image_url: 'https://images.pexels.com/photos/1084199/pexels-photo-1084199.jpeg?auto=compress&cs=tinysrgb&w=400'
      }
    ];

    const insertProduct = db.prepare(`
      INSERT OR IGNORE INTO products (name, description, sku, price, cost_price, stock_quantity, category_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    sampleProducts.forEach(product => {
      insertProduct.run(
        product.name, product.description, product.sku, product.price,
        product.cost_price, product.stock_quantity, product.category_id, product.image_url
      );
    });
    insertProduct.finalize();

    // Insert sample customers
    const sampleCustomers = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+1-555-0123',
        total_orders: 12,
        total_spent: 2459.99,
        last_order_date: '2024-01-15 10:30:00'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        phone: '+1-555-0124',
        total_orders: 8,
        total_spent: 1234.50,
        last_order_date: '2024-01-14 14:20:00'
      },
      {
        first_name: 'Mike',
        last_name: 'Johnson',
        email: 'mike@example.com',
        phone: '+1-555-0125',
        total_orders: 3,
        total_spent: 567.25,
        last_order_date: '2023-12-20 09:15:00'
      },
      {
        first_name: 'Sarah',
        last_name: 'Wilson',
        email: 'sarah@example.com',
        phone: '+1-555-0126',
        total_orders: 15,
        total_spent: 3890.75,
        last_order_date: '2024-01-16 16:45:00'
      },
      {
        first_name: 'David',
        last_name: 'Brown',
        email: 'david@example.com',
        phone: '+1-555-0127',
        total_orders: 1,
        total_spent: 89.99,
        last_order_date: '2024-01-10 11:30:00'
      }
    ];

    const insertCustomer = db.prepare(`
      INSERT OR IGNORE INTO customers (first_name, last_name, email, phone, total_orders, total_spent, last_order_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    sampleCustomers.forEach(customer => {
      insertCustomer.run(
        customer.first_name, customer.last_name, customer.email, customer.phone,
        customer.total_orders, customer.total_spent, customer.last_order_date
      );
    });
    insertCustomer.finalize();

    // Banners table
    db.run(`
      CREATE TABLE IF NOT EXISTS banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT NOT NULL,
        text_overlay TEXT,
        text_position TEXT DEFAULT 'center', -- center, top-left, top-right, bottom-left, bottom-right
        text_color TEXT DEFAULT '#ffffff',
        text_size TEXT DEFAULT 'large', -- small, medium, large, xl
        background_overlay BOOLEAN DEFAULT 0,
        overlay_opacity DECIMAL(3,2) DEFAULT 0.5,
        link_url TEXT,
        link_text TEXT,
        is_active BOOLEAN DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert sample banners
    const sampleBanners = [
      {
        title: 'Summer Sale 2024',
        description: 'Get up to 50% off on all summer collection',
        image_url: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1200',
        text_overlay: 'Summer Sale\nUp to 50% OFF',
        text_position: 'center',
        text_color: '#ffffff',
        text_size: 'xl',
        background_overlay: 1,
        overlay_opacity: 0.4,
        link_url: '/products?category=summer',
        link_text: 'Shop Now',
        display_order: 1
      },
      {
        title: 'New Arrivals',
        description: 'Check out our latest products',
        image_url: 'https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg?auto=compress&cs=tinysrgb&w=1200',
        text_overlay: 'New Arrivals\nFresh & Trendy',
        text_position: 'top-left',
        text_color: '#000000',
        text_size: 'large',
        background_overlay: 0,
        link_url: '/products?filter=new',
        link_text: 'Explore',
        display_order: 2
      },
      {
        title: 'Free Shipping',
        description: 'Free shipping on orders over $100',
        image_url: 'https://images.pexels.com/photos/230544/pexels-photo-230544.jpeg?auto=compress&cs=tinysrgb&w=1200',
        text_overlay: 'Free Shipping\nOn Orders $100+',
        text_position: 'bottom-right',
        text_color: '#ffffff',
        text_size: 'medium',
        background_overlay: 1,
        overlay_opacity: 0.6,
        display_order: 3
      }
    ];

    const insertBanner = db.prepare(`
      INSERT OR IGNORE INTO banners (
        title, description, image_url, text_overlay, text_position, text_color,
        text_size, background_overlay, overlay_opacity, link_url, link_text, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    sampleBanners.forEach(banner => {
      insertBanner.run(
        banner.title, banner.description, banner.image_url, banner.text_overlay,
        banner.text_position, banner.text_color, banner.text_size, banner.background_overlay,
        banner.overlay_opacity, banner.link_url, banner.link_text, banner.display_order
      );
    });
    insertBanner.finalize();

    // Insert sample orders
    const sampleOrders = [
      {
        order_number: 'ORD-001',
        customer_id: 1,
        status: 'delivered',
        payment_status: 'paid',
        payment_method: 'credit_card',
        subtotal: 299.99,
        tax_amount: 24.00,
        shipping_amount: 9.99,
        total_amount: 333.98,
        created_at: '2024-01-15 10:30:00'
      },
      {
        order_number: 'ORD-002',
        customer_id: 2,
        status: 'shipped',
        payment_status: 'paid',
        payment_method: 'paypal',
        subtotal: 74.97,
        tax_amount: 6.00,
        shipping_amount: 9.99,
        total_amount: 90.96,
        created_at: '2024-01-14 14:20:00'
      },
      {
        order_number: 'ORD-003',
        customer_id: 3,
        status: 'processing',
        payment_status: 'paid',
        payment_method: 'credit_card',
        subtotal: 199.99,
        tax_amount: 16.00,
        shipping_amount: 0.00,
        total_amount: 215.99,
        created_at: '2024-01-13 09:15:00'
      },
      {
        order_number: 'ORD-004',
        customer_id: 4,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'bank_transfer',
        subtotal: 40.50,
        tax_amount: 3.24,
        shipping_amount: 5.99,
        total_amount: 49.73,
        created_at: '2024-01-12 16:45:00'
      },
      {
        order_number: 'ORD-005',
        customer_id: 5,
        status: 'cancelled',
        payment_status: 'refunded',
        payment_method: 'credit_card',
        subtotal: 350.00,
        tax_amount: 28.00,
        shipping_amount: 15.99,
        total_amount: 393.99,
        created_at: '2024-01-11 11:30:00'
      }
    ];

    const insertOrder = db.prepare(`
      INSERT OR IGNORE INTO orders (order_number, customer_id, status, payment_status, payment_method, subtotal, tax_amount, shipping_amount, total_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    sampleOrders.forEach(order => {
      insertOrder.run(
        order.order_number, order.customer_id, order.status, order.payment_status,
        order.payment_method, order.subtotal, order.tax_amount, order.shipping_amount,
        order.total_amount, order.created_at
      );
    });
    insertOrder.finalize();

    // Create default admin user
    const defaultPassword = 'admin123';
    bcrypt.hash(defaultPassword, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err);
        return;
      }

      db.run(`
        INSERT OR IGNORE INTO admin_users (username, email, password)
        VALUES (?, ?, ?)
      `, ['admin', 'admin@example.com', hashedPassword], function(err) {
        if (err) {
          console.error('Error creating admin user:', err);
        } else if (this.changes > 0) {
          console.log('✅ Default admin user created (admin@example.com / admin123)');
        }
      });
    });

    console.log('✅ Database initialized successfully');
  });
};

const getDatabase = () => db;

module.exports = {
  initializeDatabase,
  getDatabase
};