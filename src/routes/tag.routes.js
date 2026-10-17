const router = require('express').Router();
const tagController = require('../controllers/tag.controller');
const validate = require('../middlewares/validate.middleware');
const { createTag } = require('../validations/tag.validation');

router.get('/', tagController.getAll);
router.post('/', validate(createTag), tagController.create);

module.exports = router;
