const { query } = require('../config/database');

// ── GET /api/reports/dashboard ────────────────────────────────────────────────
// Summary cards for the home screen
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const isEmployee = role === 'employee';

    // Task counts
    const taskStats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled')::int AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'done')::int AS completed_tasks,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_tasks,
        COUNT(*) FILTER (WHERE status = 'todo')::int AS todo_tasks,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('done','cancelled'))::int AS overdue_tasks
      FROM tasks
      ${isEmployee ? 'WHERE assigned_to = $1' : ''}
    `, isEmployee ? [userId] : []);

    // Project counts
    const projectStats = await query(`
      SELECT
        COUNT(*)::int AS total_projects,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_projects,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_projects
      FROM projects ${isEmployee ? `WHERE id IN (SELECT project_id FROM project_members WHERE user_id = $1)` : ''}
    `, isEmployee ? [userId] : []);

    // Hours this week
    const hoursThisWeek = await query(`
      SELECT COALESCE(SUM(hours), 0)::numeric AS hours_this_week
      FROM time_logs
      WHERE logged_date >= DATE_TRUNC('week', CURRENT_DATE)
      ${isEmployee ? 'AND user_id = $1' : ''}
    `, isEmployee ? [userId] : []);

    // Recent tasks (last 5)
    const recentTasks = await query(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date,
             u.full_name AS assigned_to_name, p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN projects p ON p.id = t.project_id
      ${isEmployee ? 'WHERE t.assigned_to = $1' : ''}
      ORDER BY t.updated_at DESC LIMIT 5
    `, isEmployee ? [userId] : []);

    // Tasks by status (for pie chart)
    const tasksByStatus = await query(`
      SELECT status, COUNT(*)::int AS count
      FROM tasks
      ${isEmployee ? 'WHERE assigned_to = $1' : ''}
      GROUP BY status
    `, isEmployee ? [userId] : []);

    res.json({
      success: true,
      data: {
        tasks: taskStats.rows[0],
        projects: projectStats.rows[0],
        hours_this_week: parseFloat(hoursThisWeek.rows[0].hours_this_week),
        recent_tasks: recentTasks.rows,
        tasks_by_status: tasksByStatus.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/reports/time  (date-range report) ────────────────────────────────
const getTimeReport = async (req, res, next) => {
  try {
    const { from, to, user_id, project_id, group_by = 'user' } = req.query;

    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from and to date params are required.' });
    }

    const isEmployee = req.user.role === 'employee';
    const params = [from, to];
    const extraWhere = isEmployee ? ` AND tl.user_id = $${params.push(req.user.id)}` : '';

    let sql = '';

    if (group_by === 'user') {
      sql = `
        SELECT u.id AS user_id, u.full_name, u.avatar,
               SUM(tl.hours)::numeric AS total_hours,
               COUNT(DISTINCT tl.task_id)::int AS tasks_worked
        FROM time_logs tl
        JOIN users u ON u.id = tl.user_id
        JOIN tasks t ON t.id = tl.task_id
        WHERE tl.logged_date BETWEEN $1 AND $2 ${extraWhere}
        ${project_id ? `AND t.project_id = $${params.push(project_id)}` : ''}
        ${!isEmployee && user_id ? `AND tl.user_id = $${params.push(user_id)}` : ''}
        GROUP BY u.id, u.full_name, u.avatar
        ORDER BY total_hours DESC
      `;
    } else if (group_by === 'project') {
      sql = `
        SELECT p.id AS project_id, p.name AS project_name, p.status,
               SUM(tl.hours)::numeric AS total_hours,
               COUNT(DISTINCT tl.user_id)::int AS contributors
        FROM time_logs tl
        JOIN tasks t ON t.id = tl.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE tl.logged_date BETWEEN $1 AND $2 ${extraWhere}
        GROUP BY p.id, p.name, p.status
        ORDER BY total_hours DESC
      `;
    } else if (group_by === 'day') {
      sql = `
        SELECT tl.logged_date::text AS date, SUM(tl.hours)::numeric AS total_hours
        FROM time_logs tl
        WHERE tl.logged_date BETWEEN $1 AND $2 ${extraWhere}
        GROUP BY tl.logged_date ORDER BY tl.logged_date ASC
      `;
    }

    const result = await query(sql, params);
    const totalHours = result.rows.reduce((s, r) => s + parseFloat(r.total_hours || 0), 0);

    res.json({ success: true, data: result.rows, total_hours: totalHours, count: result.rowCount });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/reports/tasks ────────────────────────────────────────────────────
const getTaskReport = async (req, res, next) => {
  try {
    const { from, to, project_id } = req.query;
    const params = [];
    const where = [];

    if (from) { params.push(from); where.push(`t.created_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`t.created_at <= $${params.length}`); }
    if (project_id) { params.push(project_id); where.push(`t.project_id = $${params.length}`); }
    if (req.user.role === 'employee') { params.push(req.user.id); where.push(`t.assigned_to = $${params.length}`); }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const byPriority = await query(
      `SELECT priority, COUNT(*)::int AS count FROM tasks t ${whereStr} GROUP BY priority`,
      params
    );
    const byStatus = await query(
      `SELECT status, COUNT(*)::int AS count FROM tasks t ${whereStr} GROUP BY status`,
      params
    );
    const completionTime = await query(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric(10,2) AS avg_hours_to_complete
      FROM tasks t ${whereStr ? whereStr + ' AND' : 'WHERE'} completed_at IS NOT NULL
    `, params);

    res.json({
      success: true,
      data: {
        by_priority: byPriority.rows,
        by_status: byStatus.rows,
        avg_hours_to_complete: completionTime.rows[0].avg_hours_to_complete
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/reports/calendar ─────────────────────────────────────────────────
// Returns tasks due in a given month/week for calendar view
const getCalendar = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required.' });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

    const isEmployee = req.user.role === 'employee';
    const params = [startDate, endDate];
    if (isEmployee) params.push(req.user.id);

    const result = await query(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date,
             u.full_name AS assigned_to_name, p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.due_date BETWEEN $1 AND $2
      ${isEmployee ? 'AND t.assigned_to = $3' : ''}
      ORDER BY t.due_date ASC
    `, params);

    res.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getTimeReport, getTaskReport, getCalendar };
