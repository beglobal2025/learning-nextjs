const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const initializeDatabase = () => {
  console.log('🗄️  Initializing SQLite database...');

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables first
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
        images TEXT,
        weight DECIMAL(8,2),
        dimensions TEXT,
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
        type TEXT DEFAULT 'shipping',
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
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'pending',
        payment_method TEXT,
        subtotal DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        shipping_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        notes TEXT,
        shipping_address TEXT,
        billing_address TEXT,
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

    // Banners table
    db.run(`
      CREATE TABLE IF NOT EXISTS banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT NOT NULL,
        text_overlay TEXT,
        text_position TEXT DEFAULT 'center',
        text_color TEXT DEFAULT '#ffffff',
        text_size TEXT DEFAULT 'large',
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

    // Insert default categories first
    // const defaultCategories = [
    //   { name: 'Electronics', description: 'Electronic devices and gadgets', slug: 'electronics' },
    //   { name: 'Clothing', description: 'Fashion and apparel', slug: 'clothing' },
    //   { name: 'Books', description: 'Books and educational materials', slug: 'books' },
    //   { name: 'Home & Garden', description: 'Home improvement and garden supplies', slug: 'home-garden' },
    //   { name: 'Sports', description: 'Sports and fitness equipment', slug: 'sports' }
    // ];

    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO categories (name, description, slug) VALUES (?, ?, ?)
    `);

    // defaultCategories.forEach(category => {
    //   insertCategory.run(category.name, category.description, category.slug);
    // });
    insertCategory.finalize();

    // Insert products after categories
    // const sampleProducts = [
    //   {
    //     name: 'Wireless Bluetooth Headphones',
    //     description: 'High-quality wireless headphones with noise cancellation',
    //     sku: 'WH-001',
    //     price: 299.99,
    //     cost_price: 150.00,
    //     stock_quantity: 45,
    //     category_id: 1,
    //     image_url: 'https://images.pexels.com/photos/3394650/pexels-photo-339
    // ];

    const insertProduct = db.prepare(`
      INSERT OR IGNORE INTO products (name, description, sku, price, cost_price, stock_quantity, category_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // sampleProducts.forEach(product => {
    //   insertProduct.run(
    //     product.name, product.description, product.sku, product.price,
    //     product.cost_price, product.stock_quantity, product.category_id, product.image_url
    //   );
    // });
    insertProduct.finalize();

    // Insert customers
    const sampleCustomers = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+1-555-0123'
      }
    ];

    const insertCustomer = db.prepare(`
      INSERT OR IGNORE INTO customers (first_name, last_name, email, phone)
      VALUES (?, ?, ?, ?)
    `);

    sampleCustomers.forEach(customer => {
      insertCustomer.run(customer.first_name, customer.last_name, customer.email, customer.phone);
    });
    insertCustomer.finalize();

    // Create default admin user
    const defaultPassword = 'admin123';
    bcrypt.hash('admin123', 10, (err, hashedPassword) => {
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
