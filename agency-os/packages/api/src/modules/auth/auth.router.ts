// packages/api/src/modules/auth/auth.router.ts
import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { loginSchema, registerSchema, resetPasswordSchema } from './auth.schema';
import { rateLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', rateLimiter(10, 15), validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', rateLimiter(3, 60), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;