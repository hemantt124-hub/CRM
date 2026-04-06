const { query } = require('../config/database');

// ── GET /api/time-logs ───────────────────────────────────────────────────────
const getTimeLogs = async (req, res, next) => {
  try {
    const { user_id, task_id, from, to } = req.query;
    const params = [];
    const where = [];

    // Employees only see their own time logs
    if (req.user.role === 'employee') {
      params.push(req.user.id);
      where.push(`tl.user_id = $${params.length}`);
    } else if (user_id) {
      params.push(user_id);
      where.push(`tl.user_id = $${params.length}`);
    }

    if (task_id) { params.push(task_id); where.push(`tl.task_id = $${params.length}`); }
    if (from) { params.push(from); where.push(`tl.logged_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`tl.logged_date <= $${params.length}`); }

    const sql = `
      SELECT tl.*, u.full_name AS user_name, t.title AS task_title, p.name AS project_name
      FROM time_logs tl
      JOIN users u ON u.id = tl.user_id
      JOIN tasks t ON t.id = tl.task_id
      JOIN projects p ON p.id = t.project_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY tl.logged_date DESC, tl.created_at DESC
    `;

    const result = await query(sql, params);

    const totalHours = result.rows.reduce((sum, r) => sum + parseFloat(r.hours), 0);
    res.json({ success: true, data: result.rows, count: result.rowCount, total_hours: totalHours });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/time-logs ──────────────────────────────────────────────────────
const createTimeLog = async (req, res, next) => {
  try {
    const { task_id, hours, description, logged_date } = req.body;

    // Verify the task exists and user has access
    const taskCheck = await query('SELECT id, assigned_to FROM tasks WHERE id = $1', [task_id]);
    if (!taskCheck.rows[0]) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    if (req.user.role === 'employee' && taskCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only log time on your own tasks.' });
    }

    const result = await query(
      `INSERT INTO time_logs (task_id, user_id, hours, description, logged_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [task_id, req.user.id, hours, description, logged_date || new Date().toISOString().split('T')[0]]
    );

    res.status(201).json({ success: true, message: 'Time logged.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/time-logs/:id ─────────────────────────────────────────────────
const deleteTimeLog = async (req, res, next) => {
  try {
    const logCheck = await query('SELECT user_id FROM time_logs WHERE id=$1', [req.params.id]);
    if (!logCheck.rows[0]) return res.status(404).json({ success: false, message: 'Time log not found.' });

    // Only the owner or admin can delete
    if (req.user.role === 'employee' && logCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Cannot delete other users\' time logs.' });
    }

    await query('DELETE FROM time_logs WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Time log deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTimeLogs, createTimeLog, deleteTimeLog };
