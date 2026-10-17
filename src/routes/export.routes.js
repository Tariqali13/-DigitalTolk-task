const router = require('express').Router();
const exportController = require('../controllers/export.controller');
const validate = require('../middlewares/validate.middleware');
const { exportQuery } = require('../validations/translation.validation');

router.get('/:locale', validate(exportQuery, 'query'), exportController.exportLocale);

module.exports = router;
