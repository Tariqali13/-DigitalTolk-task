const router = require('express').Router();
const translationController = require('../controllers/translation.controller');
const validate = require('../middlewares/validate.middleware');
const { idParam } = require('../validations/common');
const {
  createTranslation,
  updateTranslation,
  searchTranslations,
} = require('../validations/translation.validation');

router.get('/', validate(searchTranslations, 'query'), translationController.search);
router.post('/', validate(createTranslation), translationController.create);
router.get('/:id', validate(idParam, 'params'), translationController.getById);
router.put('/:id', validate(idParam, 'params'), validate(updateTranslation), translationController.update);
router.delete('/:id', validate(idParam, 'params'), translationController.remove);

module.exports = router;
