const router = require('express').Router();
const { body } = require('express-validator');
const { getProjects, getProjectById, createProject, updateProject, deleteProject, addMember, removeMember } = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProjectById);

router.post('/',
  authorize('admin', 'manager'),
  [body('name').trim().notEmpty().withMessage('Project name is required')],
  handleValidation,
  createProject
);

router.put('/:id',
  authorize('admin', 'manager'),
  [body('name').trim().notEmpty()],
  handleValidation,
  updateProject
);

router.delete('/:id', authorize('admin'), deleteProject);

router.post('/:id/members',
  authorize('admin', 'manager'),
  [body('user_id').isInt()],
  handleValidation,
  addMember
);

router.delete('/:id/members/:userId', authorize('admin', 'manager'), removeMember);

module.exports = router;
