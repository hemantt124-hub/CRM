const router = require('express').Router();
const { getDashboard, getTimeReport, getTaskReport, getCalendar } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', getDashboard);
router.get('/time', getTimeReport);
router.get('/tasks', getTaskReport);
router.get('/calendar', getCalendar);

module.exports = router;
