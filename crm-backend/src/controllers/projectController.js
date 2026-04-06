const { query, getClient } = require('../config/database');

// ── GET /api/projects ────────────────────────────────────────────────────────
const getProjects = async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    const isEmployee = req.user.role === 'employee';

    let sql = `
      SELECT p.*,
             u.full_name AS manager_name,
             COUNT(DISTINCT t.id)::int AS task_count,
             COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END)::int AS completed_tasks,
             COUNT(DISTINCT pm.user_id)::int AS member_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.manager_id
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN project_members pm ON pm.project_id = p.id
    `;

    const params = [];
    const where = [];

    // Employees only see projects they belong to
    if (isEmployee) {
      params.push(req.user.id);
      where.push(`p.id IN (SELECT project_id FROM project_members WHERE user_id = $${params.length})`);
    }
    if (status) { params.push(status); where.push(`p.status = $${params.length}`); }
    if (priority) { params.push(priority); where.push(`p.priority = $${params.length}`); }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' GROUP BY p.id, u.full_name ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/projects/:id ────────────────────────────────────────────────────
const getProjectById = async (req, res, next) => {
  try {
    const projectResult = await query(`
      SELECT p.*, u.full_name AS manager_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.manager_id
      WHERE p.id = $1
    `, [req.params.id]);

    if (!projectResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Get members
    const membersResult = await query(`
      SELECT u.id, u.full_name, u.avatar, u.role, pm.role AS project_role, pm.joined_at
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
    `, [req.params.id]);

    res.json({
      success: true,
      data: { ...projectResult.rows[0], members: membersResult.rows }
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/projects  (admin, manager) ─────────────────────────────────────
const createProject = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { name, description, status, priority, manager_id, start_date, due_date, member_ids } = req.body;

    const result = await client.query(
      `INSERT INTO projects (name, description, status, priority, manager_id, start_date, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description, status || 'active', priority || 'medium', manager_id, start_date, due_date, req.user.id]
    );
    const project = result.rows[0];

    // Add members
    if (member_ids?.length) {
      for (const uid of member_ids) {
        await client.query(
          'INSERT INTO project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [project.id, uid]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Project created.', data: project });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ── PUT /api/projects/:id  (admin, manager) ───────────────────────────────────
const updateProject = async (req, res, next) => {
  try {
    const { name, description, status, priority, manager_id, start_date, due_date } = req.body;
    const result = await query(
      `UPDATE projects SET name=$1, description=$2, status=$3, priority=$4,
       manager_id=$5, start_date=$6, due_date=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, description, status, priority, manager_id, start_date, due_date, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Project not found.' });
    res.json({ success: true, message: 'Project updated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/projects/:id  (admin only) ────────────────────────────────────
const deleteProject = async (req, res, next) => {
  try {
    const result = await query('DELETE FROM projects WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Project not found.' });
    res.json({ success: true, message: 'Project deleted.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/projects/:id/members ───────────────────────────────────────────
const addMember = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    await query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );
    res.json({ success: true, message: 'Member added.' });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/projects/:id/members/:userId ──────────────────────────────────
const removeMember = async (req, res, next) => {
  try {
    await query(
      'DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',
      [req.params.id, req.params.userId]
    );
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject, addMember, removeMember };
