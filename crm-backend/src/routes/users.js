const router = require('express').Router();
const { body } = require('express-validator');
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

router.use(authenticate);

router.get('/', authorize('admin', 'manager'), getUsers);
router.get('/:id', getUserById);

router.post('/',
  authorize('admin'),
  [
    body('username').trim().notEmpty().isLength({ min: 3, max: 50 }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').trim().notEmpty(),
    body('role').isIn(['admin', 'manager', 'employee']),
  ],
  handleValidation,
  createUser
);

router.put('/:id',
  authorize('admin'),
  [
    body('full_name').trim().notEmpty(),
    body('role').isIn(['admin', 'manager', 'employee']),
  ],
  handleValidation,
  updateUser
);

router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
