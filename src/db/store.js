import { query, run, insert, commit, resetDb } from './index.js';

export { resetDb };

function buildUpdate(table, id, fields, allowed) {
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  if (!keys.length) return false;
  run(
    `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`,
    [...keys.map((k) => fields[k]), id]
  );
  return true;
}

// ---------- Sozlamalar ----------

export function getSettings() {
  return Object.fromEntries(query('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
}

export function saveSettings(obj) {
  for (const [key, value] of Object.entries(obj)) {
    run(
      'INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, String(value)]
    );
  }
  commit();
}

function nextOrderNumber() {
  const n = parseInt(getSettings().next_order_number || '1001', 10);
  run(
    'INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ['next_order_number', String(n + 1)]
  );
  return n;
}

// ---------- Kategoriyalar ----------

export function getCategories() {
  return query('SELECT * FROM categories ORDER BY sort_order, id');
}

export function addCategory({ name, emoji = '', color = '#f97316' }) {
  const max = query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories')[0].n;
  const id = insert('INSERT INTO categories(name, emoji, color, sort_order) VALUES(?,?,?,?)', [name, emoji, color, max]);
  commit();
  return id;
}

export function updateCategory(id, fields) {
  buildUpdate('categories', id, fields, ['name', 'emoji', 'color', 'sort_order']);
  commit();
}

export function deleteCategory(id) {
  const c = query('SELECT COUNT(*) AS c FROM products WHERE category_id=?', [id])[0].c;
  if (c > 0) throw new Error("Bu kategoriyada mahsulotlar bor. Avval ularni boshqa kategoriyaga o'tkazing.");
  run('DELETE FROM categories WHERE id=?', [id]);
  commit();
}

// ---------- Mahsulotlar ----------

export function getProducts({ activeOnly = false, categoryId = null } = {}) {
  let sql = 'SELECT p.*, c.name AS category_name, c.color AS category_color FROM products p JOIN categories c ON c.id=p.category_id WHERE 1=1';
  const params = [];
  if (activeOnly) {
    sql += ' AND p.active=1';
  }
  if (categoryId) {
    sql += ' AND p.category_id=?';
    params.push(categoryId);
  }
  sql += ' ORDER BY p.sort_order, p.id';
  return query(sql, params);
}

export function getProduct(id) {
  return query('SELECT * FROM products WHERE id=?', [id])[0] || null;
}

export function addProduct(p) {
  const max = query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM products')[0].n;
  const id = insert(
    `INSERT INTO products(category_id, name, price, emoji, active, track_stock, stock_qty, low_stock, unit, sort_order)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [p.category_id, p.name, p.price, p.emoji || '🍽️', p.active ?? 1, p.track_stock ? 1 : 0, p.stock_qty || 0, p.low_stock ?? 5, p.unit || 'dona', max]
  );
  commit();
  return id;
}

export function updateProduct(id, fields) {
  if (fields.track_stock !== undefined) fields.track_stock = fields.track_stock ? 1 : 0;
  if (fields.active !== undefined) fields.active = fields.active ? 1 : 0;
  buildUpdate('products', id, fields, ['category_id', 'name', 'price', 'emoji', 'active', 'track_stock', 'stock_qty', 'low_stock', 'unit']);
  commit();
}

export function deleteProduct(id) {
  const used = query('SELECT COUNT(*) AS c FROM order_items WHERE product_id=?', [id])[0].c;
  if (used > 0) {
    run('UPDATE products SET active=0 WHERE id=?', [id]);
  } else {
    run('DELETE FROM stock_movements WHERE product_id=?', [id]);
    run('DELETE FROM products WHERE id=?', [id]);
  }
  commit();
}

// ---------- Stollar ----------

export function getTables() {
  return query('SELECT * FROM tables ORDER BY zone, sort_order, id');
}

export function getTableStates() {
  return query(`
    SELECT t.*,
      o.id AS order_id, o.number AS order_number, o.total AS order_total,
      o.created_at AS order_since, o.kitchen_status AS order_kitchen,
      (SELECT COALESCE(SUM(qty), 0) FROM order_items oi WHERE oi.order_id=o.id) AS item_count
    FROM tables t
    LEFT JOIN orders o ON o.table_id=t.id AND o.status='open'
    ORDER BY t.zone, t.sort_order, t.id
  `);
}

export function addTable({ name, zone = 'Asosiy zal', seats = 4 }) {
  const max = query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM tables')[0].n;
  const id = insert('INSERT INTO tables(name, zone, seats, sort_order) VALUES(?,?,?,?)', [name, zone, seats, max]);
  commit();
  return id;
}

export function updateTable(id, fields) {
  buildUpdate('tables', id, fields, ['name', 'zone', 'seats', 'sort_order']);
  commit();
}

export function deleteTable(id) {
  const open = query("SELECT COUNT(*) AS c FROM orders WHERE table_id=? AND status='open'", [id])[0].c;
  if (open > 0) throw new Error("Bu stolda ochiq buyurtma bor. Avval uni yoping.");
  run('UPDATE orders SET table_id=NULL WHERE table_id=?', [id]);
  run('DELETE FROM tables WHERE id=?', [id]);
  commit();
}

export function getZones() {
  return query('SELECT DISTINCT zone FROM tables ORDER BY zone').map((r) => r.zone);
}

// ---------- Buyurtmalar ----------

function calcTotals(items, discountPercent) {
  const subtotal = items.reduce((s, it) => s + Math.round(it.price * it.qty), 0);
  const discount = Math.round((subtotal * (discountPercent || 0)) / 100);
  return { subtotal, discount, total: subtotal - discount };
}

function insertItems(orderId, items) {
  for (const it of items) {
    run(
      'INSERT INTO order_items(order_id, product_id, name, price, qty, total, note) VALUES(?,?,?,?,?,?,?)',
      [orderId, it.product_id || null, it.name, it.price, it.qty, Math.round(it.price * it.qty), it.note || '']
    );
  }
}

export function createOrder({ type = 'takeaway', table_id = null, items, discount_percent = 0, note = '', sendToKitchen = false }) {
  if (!items || !items.length) throw new Error("Buyurtma bo'sh");
  if (table_id) {
    const busy = query("SELECT COUNT(*) AS c FROM orders WHERE table_id=? AND status='open'", [table_id])[0].c;
    if (busy > 0) throw new Error('Bu stol band');
  }
  const number = nextOrderNumber();
  const { subtotal, discount, total } = calcTotals(items, discount_percent);
  const id = insert(
    `INSERT INTO orders(number, type, table_id, status, kitchen_status, subtotal, discount_percent, discount, total, note)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [number, type, table_id, 'open', sendToKitchen ? 'new' : 'none', subtotal, discount_percent, discount, total, note]
  );
  insertItems(id, items);
  commit();
  return getOrder(id);
}

export function updateOrder(id, { items, discount_percent = 0, note = '', type, table_id }) {
  const order = getOrder(id);
  if (!order) throw new Error('Buyurtma topilmadi');
  if (order.status !== 'open') throw new Error('Faqat ochiq buyurtmani tahrirlash mumkin');
  if (!items || !items.length) throw new Error("Buyurtma bo'sh");
  if (table_id) {
    const busy = query("SELECT COUNT(*) AS c FROM orders WHERE table_id=? AND status='open' AND id<>?", [table_id, id])[0].c;
    if (busy > 0) throw new Error('Bu stol band');
  }
  const { subtotal, discount, total } = calcTotals(items, discount_percent);
  run(
    'UPDATE orders SET type=?, table_id=?, subtotal=?, discount_percent=?, discount=?, total=?, note=? WHERE id=?',
    [type ?? order.type, table_id !== undefined ? table_id : order.table_id, subtotal, discount_percent, discount, total, note, id]
  );
  run('DELETE FROM order_items WHERE order_id=?', [id]);
  insertItems(id, items);
  commit();
  return getOrder(id);
}

export function sendToKitchen(id) {
  const order = getOrder(id);
  if (!order) throw new Error('Buyurtma topilmadi');
  if (order.kitchen_status === 'none') {
    run("UPDATE orders SET kitchen_status='new' WHERE id=?", [id]);
    commit();
  }
  return getOrder(id);
}

export function payOrder(id, { method, received = null }) {
  const order = getOrder(id);
  if (!order) throw new Error('Buyurtma topilmadi');
  if (order.status !== 'open') throw new Error("Bu buyurtma allaqachon to'langan yoki bekor qilingan");
  let receivedAmount = order.total;
  let change = 0;
  if (method === 'cash') {
    receivedAmount = received ?? order.total;
    if (receivedAmount < order.total) throw new Error("Kiritilgan summa yetarli emas");
    change = receivedAmount - order.total;
  }
  run(
    `UPDATE orders SET status='paid', payment_method=?, received=?, change_amount=?,
     paid_at=datetime('now','localtime'),
     kitchen_status=CASE WHEN kitchen_status='none' THEN 'new' ELSE kitchen_status END
     WHERE id=?`,
    [method, receivedAmount, change, id]
  );
  for (const it of order.items) {
    if (!it.product_id) continue;
    const p = query('SELECT track_stock FROM products WHERE id=?', [it.product_id])[0];
    if (p && p.track_stock) {
      run('UPDATE products SET stock_qty=stock_qty-? WHERE id=?', [it.qty, it.product_id]);
      run(
        'INSERT INTO stock_movements(product_id, delta, reason, note, order_id) VALUES(?,?,?,?,?)',
        [it.product_id, -it.qty, 'sale', `Buyurtma №${order.number}`, id]
      );
    }
  }
  commit();
  return getOrder(id);
}

export function cancelOrder(id) {
  const order = getOrder(id);
  if (!order) throw new Error('Buyurtma topilmadi');
  if (order.status !== 'open') throw new Error("Faqat ochiq buyurtmani bekor qilish mumkin");
  run("UPDATE orders SET status='cancelled', kitchen_status='none' WHERE id=?", [id]);
  commit();
}

export function setKitchenStatus(id, status) {
  const allowed = ['new', 'cooking', 'ready', 'served'];
  if (!allowed.includes(status)) throw new Error("Noto'g'ri holat");
  run('UPDATE orders SET kitchen_status=? WHERE id=?', [status, id]);
  commit();
}

export function getOrder(id) {
  const order = query(
    `SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id=o.table_id WHERE o.id=?`,
    [id]
  )[0];
  if (!order) return null;
  order.items = query('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [id]);
  return order;
}

export function getOpenOrders() {
  return query(`
    SELECT o.*, t.name AS table_name,
      (SELECT COALESCE(SUM(qty), 0) FROM order_items oi WHERE oi.order_id=o.id) AS item_count
    FROM orders o LEFT JOIN tables t ON t.id=o.table_id
    WHERE o.status='open' ORDER BY o.created_at DESC
  `);
}

export function getKitchenOrders() {
  const orders = query(`
    SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id=o.table_id
    WHERE o.status<>'cancelled' AND o.kitchen_status IN ('new','cooking','ready')
    ORDER BY o.created_at ASC
  `);
  for (const o of orders) {
    o.items = query('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [o.id]);
  }
  return orders;
}

export function getOrders({ from = null, to = null, status = null, limit = 200 } = {}) {
  let sql = `SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id=o.table_id WHERE 1=1`;
  const params = [];
  if (status) {
    sql += ' AND o.status=?';
    params.push(status);
  }
  if (from) {
    sql += ' AND date(o.created_at)>=?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date(o.created_at)<=?';
    params.push(to);
  }
  sql += ' ORDER BY o.created_at DESC LIMIT ?';
  params.push(limit);
  return query(sql, params);
}

// ---------- Ombor ----------

export function stockIn(productId, qty, note = '') {
  if (!(qty > 0)) throw new Error("Miqdor 0 dan katta bo'lishi kerak");
  run('UPDATE products SET stock_qty=stock_qty+? WHERE id=?', [qty, productId]);
  run('INSERT INTO stock_movements(product_id, delta, reason, note) VALUES(?,?,?,?)', [productId, qty, 'kirim', note]);
  commit();
}

export function stockOut(productId, qty, note = '') {
  if (!(qty > 0)) throw new Error("Miqdor 0 dan katta bo'lishi kerak");
  const p = getProduct(productId);
  if (p.stock_qty < qty) throw new Error(`Qoldiq yetarli emas (mavjud: ${p.stock_qty} ${p.unit})`);
  run('UPDATE products SET stock_qty=stock_qty-? WHERE id=?', [qty, productId]);
  run('INSERT INTO stock_movements(product_id, delta, reason, note) VALUES(?,?,?,?)', [productId, -qty, 'chiqim', note]);
  commit();
}

export function getMovements({ productId = null, limit = 100 } = {}) {
  let sql = `SELECT m.*, p.name AS product_name, p.unit FROM stock_movements m JOIN products p ON p.id=m.product_id`;
  const params = [];
  if (productId) {
    sql += ' WHERE m.product_id=?';
    params.push(productId);
  }
  sql += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ?';
  params.push(limit);
  return query(sql, params);
}

export function getLowStock() {
  return query('SELECT * FROM products WHERE track_stock=1 AND stock_qty<=low_stock ORDER BY stock_qty ASC');
}

// ---------- Xarajatlar ----------

export function addExpense({ title, amount, category = 'Boshqa' }) {
  if (!(amount > 0)) throw new Error("Summa 0 dan katta bo'lishi kerak");
  const id = insert('INSERT INTO expenses(title, amount, category) VALUES(?,?,?)', [title, amount, category]);
  commit();
  return id;
}

export function getExpenses(from, to) {
  return query('SELECT * FROM expenses WHERE date(created_at) BETWEEN ? AND ? ORDER BY created_at DESC', [from, to]);
}

export function deleteExpense(id) {
  run('DELETE FROM expenses WHERE id=?', [id]);
  commit();
}

// ---------- Hisobot ----------

export function getReport(from, to) {
  const summary = query(
    `SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS revenue,
            COALESCE(SUM(discount), 0) AS discount_total,
            COALESCE(ROUND(AVG(total)), 0) AS avg_check
     FROM orders WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?`,
    [from, to]
  )[0];

  const byDay = query(
    `SELECT date(paid_at) AS day, COUNT(*) AS order_count, SUM(total) AS revenue
     FROM orders WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?
     GROUP BY date(paid_at) ORDER BY day`,
    [from, to]
  );

  const byMethod = query(
    `SELECT payment_method, COUNT(*) AS order_count, SUM(total) AS revenue
     FROM orders WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?
     GROUP BY payment_method`,
    [from, to]
  );

  const topProducts = query(
    `SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.total) AS revenue
     FROM order_items oi JOIN orders o ON o.id=oi.order_id
     WHERE o.status='paid' AND date(o.paid_at) BETWEEN ? AND ?
     GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`,
    [from, to]
  );

  const expenses = getExpenses(from, to);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    ...summary,
    byDay,
    byMethod,
    topProducts,
    expenses,
    expenseTotal,
    profit: summary.revenue - expenseTotal,
  };
}