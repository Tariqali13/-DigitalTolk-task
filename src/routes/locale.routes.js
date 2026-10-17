const router = require('express').Router();
const localeController = require('../controllers/locale.controller');
const validate = require('../middlewares/validate.middleware');
const { createLocale } = require('../validations/locale.validation');

router.get('/', localeController.getAll);
router.post('/', validate(createLocale), localeController.create);

module.exports = router;
