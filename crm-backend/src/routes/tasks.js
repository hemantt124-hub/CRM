const router = require('express').Router();
const { body } = require('express-validator');
const { getTasks, getTaskById, createTask, updateTask, updateTaskStatus, deleteTask, addComment } = require('../controllers/taskController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

router.use(authenticate);

router.get('/', getTasks);
router.get('/:id', getTaskById);

router.post('/',
  authorize('admin', 'manager'),
  [body('title').trim().notEmpty().withMessage('Task title is required')],
  handleValidation,
  createTask
);

router.put('/:id',
  [body('title').trim().notEmpty()],
  handleValidation,
  updateTask
);

router.patch('/:id/status',
  [body('status').isIn(['todo', 'in_progress', 'in_review', 'done', 'cancelled'])],
  handleValidation,
  updateTaskStatus
);

router.delete('/:id', authorize('admin', 'manager'), deleteTask);

router.post('/:id/comments',
  [body('content').trim().notEmpty()],
  handleValidation,
  addComment
);

module.exports = router;
