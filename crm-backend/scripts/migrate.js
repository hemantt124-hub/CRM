require('dotenv').config();
const { query, pool } = require('../src/config/database');

const migrate = async () => {
  console.log('🚀 Running database migrations...\n');

  try {
    // ─── USERS ───────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(50) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        full_name   VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE,
        role        VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
        is_active   BOOLEAN DEFAULT TRUE,
        avatar      VARCHAR(10),
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ users table ready');

    // ─── PROJECTS ────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(150) NOT NULL,
        description TEXT,
        status      VARCHAR(30) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
        priority    VARCHAR(20) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        manager_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        start_date  DATE,
        due_date    DATE,
        created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ projects table ready');

    // ─── PROJECT MEMBERS ─────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role        VARCHAR(30) DEFAULT 'member',
        joined_at   TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (project_id, user_id)
      );
    `);
    console.log('✅ project_members table ready');

    // ─── TASKS ───────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           SERIAL PRIMARY KEY,
        title        VARCHAR(200) NOT NULL,
        description  TEXT,
        project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        assigned_to  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status       VARCHAR(30) NOT NULL DEFAULT 'todo'
                     CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
        priority     VARCHAR(20) DEFAULT 'medium'
                     CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        due_date     DATE,
        completed_at TIMESTAMP,
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tasks table ready');

    // ─── TIME LOGS ───────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS time_logs (
        id          SERIAL PRIMARY KEY,
        task_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        hours       NUMERIC(5,2) NOT NULL CHECK (hours > 0),
        description TEXT,
        logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ time_logs table ready');

    // ─── COMMENTS ────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS comments (
        id         SERIAL PRIMARY KEY,
        task_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ comments table ready');

    // ─── ACTIVITY LOGS ───────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        entity_type VARCHAR(50),
        entity_id   INTEGER,
        action      VARCHAR(100),
        details     JSONB,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ activity_logs table ready');

    // ─── INDEXES ─────────────────────────────────────────────────────────────
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_time_logs_user ON time_logs(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(logged_date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);`);
    console.log('✅ Indexes created');

    console.log('\n🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
};

migrate().catch(() => process.exit(1));
