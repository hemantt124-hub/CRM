const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// ── GET /api/users ───────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { role, is_active, search } = req.query;
    let sql = `SELECT id, username, full_name, email, role, avatar, is_active, created_at FROM users WHERE 1=1`;
    const params = [];

    if (role) { params.push(role); sql += ` AND role = $${params.length}`; }
    if (is_active !== undefined) { params.push(is_active); sql += ` AND is_active = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (full_name ILIKE $${params.length} OR username ILIKE $${params.length})`; }

    sql += ' ORDER BY full_name ASC';
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/:id ───────────────────────────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, username, full_name, email, role, avatar, is_active, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/users  (admin only) ────────────────────────────────────────────
const createUser = async (req, res, next) => {
  try {
    const { username, password, full_name, email, role, avatar } = req.body;
    const hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (username, password, full_name, email, role, avatar)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, email, role, avatar, created_at`,
      [username, hash, full_name, email, role, avatar || full_name.slice(0, 2).toUpperCase()]
    );

    res.status(201).json({ success: true, message: 'User created.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/users/:id  (admin only) ─────────────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    const { full_name, email, role, avatar, is_active } = req.body;
    const result = await query(
      `UPDATE users SET full_name=$1, email=$2, role=$3, avatar=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id, username, full_name, email, role, avatar, is_active`,
      [full_name, email, role, avatar, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User updated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/users/:id  (admin only) ──────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    // Soft delete
    await query('UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
