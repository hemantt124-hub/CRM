require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/database');

const seed = async () => {
  console.log('🌱 Seeding database with demo data...\n');

  try {
    // ─── USERS ───────────────────────────────────────────────────────────────
    const users = [
      { username: 'admin1',   password: 'admin123', full_name: 'Admin User',    email: 'admin@fillme.com',   role: 'admin',    avatar: 'A' },
      { username: 'mgr_sara', password: 'mgr123',   full_name: 'Sara Johnson',  email: 'sara@fillme.com',    role: 'manager',  avatar: 'S' },
      { username: 'alice',    password: 'emp123',   full_name: 'Alice Smith',   email: 'alice@fillme.com',   role: 'employee', avatar: 'AL' },
      { username: 'bob',      password: 'emp123',   full_name: 'Bob Martinez',  email: 'bob@fillme.com',     role: 'employee', avatar: 'B' },
      { username: 'carol',    password: 'emp123',   full_name: 'Carol Lee',     email: 'carol@fillme.com',   role: 'employee', avatar: 'C' },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);
      await query(`
        INSERT INTO users (username, password, full_name, email, role, avatar)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (username) DO NOTHING
      `, [u.username, hash, u.full_name, u.email, u.role, u.avatar]);
    }
    console.log('✅ Users seeded (admin1, mgr_sara, alice, bob, carol)');

    // ─── PROJECTS ────────────────────────────────────────────────────────────
    const mgrRow = await query(`SELECT id FROM users WHERE username = 'mgr_sara'`);
    const adminRow = await query(`SELECT id FROM users WHERE username = 'admin1'`);
    const mgrId = mgrRow.rows[0].id;
    const adminId = adminRow.rows[0].id;

    const projects = [
      { name: 'Website Redesign',      description: 'Redesign the company website with new branding', status: 'active',    priority: 'high',   manager_id: mgrId, start_date: '2025-01-01', due_date: '2025-04-30' },
      { name: 'CRM Integration',       description: 'Integrate Salesforce CRM with internal tools',   status: 'active',    priority: 'critical', manager_id: mgrId, start_date: '2025-02-01', due_date: '2025-06-30' },
      { name: 'Mobile App v2',         description: 'Second version of the mobile application',       status: 'on_hold',   priority: 'medium', manager_id: mgrId, start_date: '2025-03-01', due_date: '2025-09-30' },
      { name: 'Q1 Marketing Campaign', description: 'Social media and email marketing for Q1',        status: 'completed', priority: 'medium', manager_id: mgrId, start_date: '2025-01-01', due_date: '2025-03-31' },
    ];

    const projectIds = [];
    for (const p of projects) {
      const res = await query(`
        INSERT INTO projects (name, description, status, priority, manager_id, start_date, due_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [p.name, p.description, p.status, p.priority, p.manager_id, p.start_date, p.due_date, adminId]);
      if (res.rows[0]) projectIds.push(res.rows[0].id);
    }
    console.log('✅ Projects seeded');

    // ─── PROJECT MEMBERS ─────────────────────────────────────────────────────
    const empRows = await query(`SELECT id FROM users WHERE role = 'employee'`);
    const empIds = empRows.rows.map(r => r.id);

    for (const pid of projectIds) {
      for (const eid of empIds) {
        await query(`
          INSERT INTO project_members (project_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [pid, eid]);
      }
    }
    console.log('✅ Project members seeded');

    // ─── TASKS ───────────────────────────────────────────────────────────────
    if (projectIds.length >= 2) {
      const tasks = [
        { title: 'Design new homepage mockup',       project_id: projectIds[0], assigned_to: empIds[0], status: 'done',        priority: 'high',   due_date: '2025-02-15' },
        { title: 'Implement responsive navigation',  project_id: projectIds[0], assigned_to: empIds[1], status: 'in_progress', priority: 'high',   due_date: '2025-03-01' },
        { title: 'SEO audit and optimization',       project_id: projectIds[0], assigned_to: empIds[2], status: 'todo',        priority: 'medium', due_date: '2025-04-01' },
        { title: 'Set up API authentication',        project_id: projectIds[1], assigned_to: empIds[0], status: 'in_review',   priority: 'critical', due_date: '2025-03-15' },
        { title: 'Map CRM data fields',              project_id: projectIds[1], assigned_to: empIds[1], status: 'done',        priority: 'high',   due_date: '2025-02-28' },
        { title: 'Write integration tests',          project_id: projectIds[1], assigned_to: empIds[2], status: 'in_progress', priority: 'medium', due_date: '2025-04-15' },
      ];

      for (const t of tasks) {
        await query(`
          INSERT INTO tasks (title, project_id, assigned_to, assigned_by, status, priority, due_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [t.title, t.project_id, t.assigned_to, mgrId, t.status, t.priority, t.due_date]);
      }
      console.log('✅ Tasks seeded');
    }

    // ─── TIME LOGS ───────────────────────────────────────────────────────────
    const taskRows = await query(`SELECT id FROM tasks LIMIT 4`);
    const taskIds = taskRows.rows.map(r => r.id);

    const timeLogs = [
      { task_id: taskIds[0], user_id: empIds[0], hours: 3.5,  description: 'Initial design exploration', logged_date: '2025-01-20' },
      { task_id: taskIds[0], user_id: empIds[0], hours: 4.0,  description: 'Revised mockup based on feedback', logged_date: '2025-01-22' },
      { task_id: taskIds[1], user_id: empIds[1], hours: 6.0,  description: 'Navigation component build', logged_date: '2025-02-05' },
      { task_id: taskIds[2], user_id: empIds[2], hours: 2.0,  description: 'Research SEO best practices', logged_date: '2025-02-10' },
    ];

    for (const tl of timeLogs.filter(l => l.task_id)) {
      await query(`
        INSERT INTO time_logs (task_id, user_id, hours, description, logged_date)
        VALUES ($1, $2, $3, $4, $5)
      `, [tl.task_id, tl.user_id, tl.hours, tl.description, tl.logged_date]);
    }
    console.log('✅ Time logs seeded');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n👤 Demo credentials:');
    console.log('   admin1   / admin123  (Admin)');
    console.log('   mgr_sara / mgr123    (Manager)');
    console.log('   alice    / emp123    (Employee)');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
};

seed().catch(() => process.exit(1));
