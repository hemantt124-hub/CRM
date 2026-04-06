const { query } = require('../config/database');

const BASE_SELECT = `
  SELECT t.*,
         p.name AS project_name,
         a.full_name AS assigned_to_name, a.avatar AS assigned_to_avatar,
         ab.full_name AS assigned_by_name
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN users a ON a.id = t.assigned_to
  LEFT JOIN users ab ON ab.id = t.assigned_by
`;

// ── GET /api/tasks ───────────────────────────────────────────────────────────
const getTasks = async (req, res, next) => {
  try {
    const { project_id, assigned_to, status, priority, due_before, due_after } = req.query;
    const params = [];
    const where = [];

    // Employees only see their own tasks
    if (req.user.role === 'employee') {
      params.push(req.user.id);
      where.push(`t.assigned_to = $${params.length}`);
    }

    if (project_id) { params.push(project_id); where.push(`t.project_id = $${params.length}`); }
    if (assigned_to) { params.push(assigned_to); where.push(`t.assigned_to = $${params.length}`); }
    if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
    if (priority) { params.push(priority); where.push(`t.priority = $${params.length}`); }
    if (due_before) { params.push(due_before); where.push(`t.due_date <= $${params.length}`); }
    if (due_after) { params.push(due_after); where.push(`t.due_date >= $${params.length}`); }

    const sql = BASE_SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY t.due_date ASC NULLS LAST, t.priority DESC';
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tasks/:id ───────────────────────────────────────────────────────
const getTaskById = async (req, res, next) => {
  try {
    const taskResult = await query(BASE_SELECT + ' WHERE t.id = $1', [req.params.id]);
    if (!taskResult.rows[0]) return res.status(404).json({ success: false, message: 'Task not found.' });

    // Get comments
    const commentsResult = await query(`
      SELECT c.*, u.full_name AS author_name, u.avatar AS author_avatar
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.task_id = $1 ORDER BY c.created_at ASC
    `, [req.params.id]);

    // Get time logs
    const timeResult = await query(`
      SELECT tl.*, u.full_name AS user_name
      FROM time_logs tl JOIN users u ON u.id = tl.user_id
      WHERE tl.task_id = $1 ORDER BY tl.logged_date DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...taskResult.rows[0],
        comments: commentsResult.rows,
        time_logs: timeResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/tasks  (admin, manager) ────────────────────────────────────────
const createTask = async (req, res, next) => {
  try {
    const { title, description, project_id, assigned_to, status, priority, due_date } = req.body;

    const result = await query(
      `INSERT INTO tasks (title, description, project_id, assigned_to, assigned_by, status, priority, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description, project_id, assigned_to, req.user.id, status || 'todo', priority || 'medium', due_date]
    );

    await query(
      `INSERT INTO activity_logs (user_id, entity_type, entity_id, action, details)
       VALUES ($1, 'task', $2, 'created', $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ title })]
    );

    res.status(201).json({ success: true, message: 'Task created.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/tasks/:id ────────────────────────────────────────────────────────
const updateTask = async (req, res, next) => {
  try {
    const { title, description, assigned_to, status, priority, due_date } = req.body;

    // Only allow employees to update their own task status
    if (req.user.role === 'employee') {
      const existing = await query('SELECT assigned_to FROM tasks WHERE id = $1', [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Task not found.' });
      if (existing.rows[0].assigned_to !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only update tasks assigned to you.' });
      }
    }

    const completedAt = status === 'done' ? 'NOW()' : 'NULL';
    const result = await query(
      `UPDATE tasks SET title=$1, description=$2, assigned_to=$3, status=$4, priority=$5,
       due_date=$6, completed_at=${completedAt}, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title, description, assigned_to, status, priority, due_date, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Task not found.' });

    await query(
      `INSERT INTO activity_logs (user_id, entity_type, entity_id, action, details)
       VALUES ($1, 'task', $2, 'updated', $3)`,
      [req.user.id, req.params.id, JSON.stringify({ status })]
    );

    res.json({ success: true, message: 'Task updated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/tasks/:id/status  (quick status update) ───────────────────────
const updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const completedAt = status === 'done' ? ', completed_at = NOW()' : '';
    const result = await query(
      `UPDATE tasks SET status=$1, updated_at=NOW() ${completedAt} WHERE id=$2 RETURNING id, status`,
      [status, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Task not found.' });
    res.json({ success: true, message: 'Status updated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/tasks/:id  (admin, manager) ───────────────────────────────────
const deleteTask = async (req, res, next) => {
  try {
    const result = await query('DELETE FROM tasks WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Task not found.' });
    res.json({ success: true, message: 'Task deleted.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/tasks/:id/comments ─────────────────────────────────────────────
const addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const result = await query(
      'INSERT INTO comments (task_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, req.user.id, content]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTasks, getTaskById, createTask, updateTask, updateTaskStatus, deleteTask, addComment };
