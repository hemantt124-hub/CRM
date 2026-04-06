const router = require('express').Router();
const { body } = require('express-validator');
const { login, getMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidation,
  login
);

router.get('/me', authenticate, getMe);

router.put('/change-password',
  authenticate,
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  handleValidation,
  changePassword
);

module.exports = router;
