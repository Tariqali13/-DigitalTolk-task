const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');

router.use('/auth', require('./auth.routes'));
router.use('/locales', auth, require('./locale.routes'));
router.use('/tags', auth, require('./tag.routes'));
router.use('/translations', auth, require('./translation.routes'));
router.use('/export', auth, require('./export.routes'));

module.exports = router;
