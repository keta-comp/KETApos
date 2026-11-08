const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  color TEXT DEFAULT '#f97316',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  active INTEGER DEFAULT 1,
  track_stock INTEGER DEFAULT 0,
  stock_qty REAL DEFAULT 0,
  low_stock REAL DEFAULT 5,
  unit TEXT DEFAULT 'dona',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  zone TEXT DEFAULT 'Asosiy zal',
  seats INTEGER DEFAULT 4,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'dine_in',
  table_id INTEGER REFERENCES tables(id),
  status TEXT NOT NULL DEFAULT 'open',
  kitchen_status TEXT NOT NULL DEFAULT 'none',
  subtotal INTEGER DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  discount INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  payment_method TEXT,
  received INTEGER,
  change_amount INTEGER,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  total INTEGER NOT NULL,
  note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delta REAL NOT NULL,
  reason TEXT NOT NULL,
  note TEXT DEFAULT '',
  order_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT DEFAULT 'Boshqa',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
`;

const CATEGORIES = [
  ['Burgerlar', '🍔', '#f97316'],
  ['Lavash', '🌯', '#eab308'],
  ['Pitsa', '🍕', '#ef4444'],
  ['Tovuq', '🍗', '#f59e0b'],
  ['Gazaklar', '🍟', '#84cc16'],
  ['Ichimliklar', '🥤', '#06b6d4'],
  ['Shirinliklar', '🍰', '#ec4899'],
];

// [categoryIndex, name, price, emoji, trackStock, stock, lowStock]
const PRODUCTS = [
  [0, 'Gamburger', 25000, '🍔', 0, 0, 5],
  [0, 'Chizburger', 28000, '🧀', 0, 0, 5],
  [0, 'Double Burger', 42000, '🍔', 0, 0, 5],
  [0, 'Tovuq burger', 27000, '🍗', 0, 0, 5],
  [1, 'Lavash tovuqli', 25000, '🌯', 0, 0, 5],
  [1, "Lavash mol go'shtli", 32000, '🌯', 0, 0, 5],
  [1, 'Lavash achchiq', 26000, '🌶️', 0, 0, 5],
  [1, 'Lavash mini', 18000, '🌯', 0, 0, 5],
  [2, 'Margarita', 45000, '🍕', 0, 0, 5],
  [2, 'Pepperoni', 55000, '🍕', 0, 0, 5],
  [2, "To'rt fasl", 60000, '🍕', 0, 0, 5],
  [2, "Qo'ziqorinli", 50000, '🍄', 0, 0, 5],
  [3, 'Tovuq qanotlari', 30000, '🍗', 0, 0, 5],
  [3, 'Naggetslar (6 dona)', 25000, '🍗', 0, 0, 5],
  [3, 'Grill tovuq', 35000, '🍗', 0, 0, 5],
  [4, 'Fri kartoshka', 15000, '🍟', 0, 0, 5],
  [4, 'Qishloqcha kartoshka', 18000, '🍟', 0, 0, 5],
  [4, 'Piyoz halqalari', 16000, '🧅', 0, 0, 5],
  [5, 'Coca-Cola 0.5L', 8000, '🥤', 1, 48, 12],
  [5, 'Fanta 0.5L', 8000, '🥤', 1, 36, 12],
  [5, 'Sprite 0.5L', 8000, '🥤', 1, 24, 12],
  [5, 'Suv 0.5L', 3000, '💧', 1, 60, 15],
  [5, 'Choy', 5000, '🍵', 0, 0, 5],
  [5, 'Kofe', 10000, '☕', 0, 0, 5],
  [5, 'Ayron', 7000, '🥛', 1, 20, 8],
  [5, 'Limonad', 12000, '🍋', 1, 18, 8],
  [6, 'Muzqaymoq', 10000, '🍦', 1, 30, 10],
  [6, 'Cheeskeyk', 25000, '🍰', 0, 0, 5],
  [6, 'Donut', 12000, '🍩', 0, 0, 5],
];

const TABLES = [];
for (let i = 1; i <= 10; i++) TABLES.push([`${i}-stol`, 'Asosiy zal', i <= 2 ? 2 : i >= 9 ? 6 : 4]);
for (let i = 1; i <= 4; i++) TABLES.push([`T${i}`, 'Terrasa', 4]);
for (let i = 1; i <= 2; i++) TABLES.push([`V${i}`, 'VIP xona', 8]);

const SETTINGS = [
  ['store_name', 'FastFood Kafe'],
  ['store_address', "Toshkent sh., Chilonzor tumani"],
  ['store_phone', '+998 90 123 45 67'],
  ['receipt_footer', 'Xaridingiz uchun rahmat!'],
  ['next_order_number', '1001'],
  ['auto_print', '0'],
];

export function migrate(db) {
  db.run(SCHEMA);
  const count = db.exec('SELECT COUNT(*) AS c FROM categories')[0].values[0][0];
  if (count > 0) return;

  const catIds = [];
  for (const [name, emoji, color] of CATEGORIES) {
    db.run('INSERT INTO categories(name, emoji, color, sort_order) VALUES(?,?,?,?)', [
      name, emoji, color, catIds.length,
    ]);
    catIds.push(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }

  PRODUCTS.forEach(([ci, name, price, emoji, track, stock, low], i) => {
    db.run(
      `INSERT INTO products(category_id, name, price, emoji, track_stock, stock_qty, low_stock, sort_order)
       VALUES(?,?,?,?,?,?,?,?)`,
      [catIds[ci], name, price, emoji, track, stock, low, i]
    );
  });

  TABLES.forEach(([name, zone, seats], i) => {
    db.run('INSERT INTO tables(name, zone, seats, sort_order) VALUES(?,?,?,?)', [name, zone, seats, i]);
  });

  for (const [key, value] of SETTINGS) {
    db.run('INSERT INTO settings(key, value) VALUES(?,?)', [key, value]);
  }
}