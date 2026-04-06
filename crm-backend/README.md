# Fillme Networks CRM — Backend API

A production-ready Node.js + Express + PostgreSQL REST API for the Fillme Networks Internal CRM.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcryptjs |
| Security | Helmet, CORS, Rate Limiting |
| Validation | express-validator |

---

## Project Structure

```
crm-backend/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js    # Login, me, change-password
│   │   ├── userController.js    # User CRUD
│   │   ├── projectController.js # Project CRUD + members
│   │   ├── taskController.js    # Task CRUD + comments + status
│   │   ├── timeLogController.js # Time tracking
│   │   └── reportController.js  # Dashboard, analytics, calendar
│   ├── middleware/
│   │   ├── auth.js              # JWT authenticate + role authorize
│   │   └── errorHandler.js      # Validation errors + global error handler
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── projects.js
│   │   ├── tasks.js
│   │   ├── timeLogs.js
│   │   └── reports.js
│   └── server.js                # App entry point
├── scripts/
│   ├── migrate.js               # Creates all DB tables
│   └── seed.js                  # Seeds demo users + sample data
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Quick Start

### 1. Prerequisites

- Node.js v18+
- PostgreSQL v14+

### 2. Clone & Install

```bash
git clone <your-repo>
cd crm-backend
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fillme_crm
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,https://hemantt124-hub.github.io
```

### 4. Create Database

```bash
psql -U postgres -c "CREATE DATABASE fillme_crm;"
```

### 5. Run Migrations

```bash
npm run migrate
```

### 6. Seed Demo Data

```bash
npm run seed
```

### 7. Start the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:3000`

---

## Demo Accounts

| Username | Password | Role |
|---|---|---|
| admin1 | admin123 | Admin |
| mgr_sara | mgr123 | Manager |
| alice | emp123 | Employee |
| bob | emp123 | Employee |
| carol | emp123 | Employee |

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Login, returns JWT token |
| GET | `/api/auth/me` | ✅ | Get current user |
| PUT | `/api/auth/change-password` | ✅ | Change password |

**Login request:**
```json
POST /api/auth/login
{
  "username": "admin1",
  "password": "admin123"
}
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin1",
      "full_name": "Admin User",
      "role": "admin"
    }
  }
}
```

---

### Users

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/users` | Admin, Manager | List all users |
| GET | `/api/users/:id` | All | Get user by ID |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Deactivate user |

**Query params for GET /api/users:**
- `role` — filter by role (`admin`, `manager`, `employee`)
- `is_active` — filter by active status (`true`/`false`)
- `search` — search by name or username

---

### Projects

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/projects` | All | List projects |
| GET | `/api/projects/:id` | All | Project + members |
| POST | `/api/projects` | Admin, Manager | Create project |
| PUT | `/api/projects/:id` | Admin, Manager | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| POST | `/api/projects/:id/members` | Admin, Manager | Add member |
| DELETE | `/api/projects/:id/members/:userId` | Admin, Manager | Remove member |

> Employees only see projects they are members of.

**Create project body:**
```json
{
  "name": "New Website",
  "description": "Redesign project",
  "status": "active",
  "priority": "high",
  "manager_id": 2,
  "start_date": "2025-01-01",
  "due_date": "2025-06-30",
  "member_ids": [3, 4, 5]
}
```

---

### Tasks

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/tasks` | All | List tasks |
| GET | `/api/tasks/:id` | All | Task + comments + time logs |
| POST | `/api/tasks` | Admin, Manager | Create task |
| PUT | `/api/tasks/:id` | All* | Update task |
| PATCH | `/api/tasks/:id/status` | All | Quick status update |
| DELETE | `/api/tasks/:id` | Admin, Manager | Delete task |
| POST | `/api/tasks/:id/comments` | All | Add comment |

> *Employees can only update tasks assigned to them.

**Query params for GET /api/tasks:**
- `project_id` — filter by project
- `assigned_to` — filter by user
- `status` — `todo`, `in_progress`, `in_review`, `done`, `cancelled`
- `priority` — `low`, `medium`, `high`, `critical`
- `due_before` / `due_after` — date range filter

**Quick status update:**
```json
PATCH /api/tasks/5/status
{ "status": "done" }
```

---

### Time Logs

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/time-logs` | All | List time logs |
| POST | `/api/time-logs` | All | Log time on a task |
| DELETE | `/api/time-logs/:id` | All* | Delete a log |

> *Employees can only delete their own logs.

**Log time:**
```json
POST /api/time-logs
{
  "task_id": 3,
  "hours": 2.5,
  "description": "Worked on navigation component",
  "logged_date": "2025-03-15"
}
```

---

### Reports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/dashboard` | Summary cards + recent tasks |
| GET | `/api/reports/time` | Date-range time report |
| GET | `/api/reports/tasks` | Task analytics by status/priority |
| GET | `/api/reports/calendar` | Tasks due in a month |

**Time report (group by user):**
```
GET /api/reports/time?from=2025-01-01&to=2025-03-31&group_by=user
```

**Time report (group by project):**
```
GET /api/reports/time?from=2025-01-01&to=2025-03-31&group_by=project
```

**Calendar for March 2025:**
```
GET /api/reports/calendar?year=2025&month=3
```

---

## Role Permissions Summary

| Feature | Admin | Manager | Employee |
|---|---|---|---|
| Manage users | ✅ | ❌ | ❌ |
| View all users | ✅ | ✅ | ❌ |
| Create/edit projects | ✅ | ✅ | ❌ |
| Delete projects | ✅ | ❌ | ❌ |
| View projects | All | All | Own only |
| Create/assign tasks | ✅ | ✅ | ❌ |
| Update task status | ✅ | ✅ | Own only |
| Log time | ✅ | ✅ | Own tasks |
| View reports | ✅ | ✅ | Own data |

---

## Deploying to Production (Render)

1. Push code to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set **Build command**: `npm install`
4. Set **Start command**: `npm start`
5. Add all environment variables from `.env.example`
6. Create a **PostgreSQL** database on Render, copy the connection string
7. Run `npm run migrate` via Render Shell after first deploy
8. Run `npm run seed` if you want demo data

**Other free hosting options:** Railway, Fly.io, Cyclic

---

## Connecting Your Frontend

In your CRM frontend JavaScript, replace hardcoded demo users with real API calls:

```javascript
// Login
const res = await fetch('https://your-api.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const { data } = await res.json();
localStorage.setItem('token', data.token);

// Authenticated request
const tasks = await fetch('https://your-api.onrender.com/api/tasks', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
```
