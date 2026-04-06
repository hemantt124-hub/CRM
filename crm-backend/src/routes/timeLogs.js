const router = require('express').Router();
const { body } = require('express-validator');
const { getTimeLogs, createTimeLog, deleteTimeLog } = require('../controllers/timeLogController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

router.use(authenticate);

router.get('/', getTimeLogs);

router.post('/',
  [
    body('task_id').isInt().withMessage('Valid task_id is required'),
    body('hours').isFloat({ min: 0.1, max: 24 }).withMessage('Hours must be between 0.1 and 24'),
  ],
  handleValidation,
  createTimeLog
);

router.delete('/:id', deleteTimeLog);

module.exports = router;
