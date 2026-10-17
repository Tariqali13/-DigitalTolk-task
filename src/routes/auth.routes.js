const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { register, login } = require('../validations/auth.validation');

// TODO: add rate limiting on login/register
router.post('/register', validate(register), authController.register);
router.post('/login', validate(login), authController.login);
router.get('/me', auth, authController.me);

module.exports = router;
