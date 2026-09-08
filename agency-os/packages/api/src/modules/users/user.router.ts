import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { userController } from './user.controller';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userParamsSchema,
} from './user.schema';

const router = Router();

router.use(authenticate);

router.get('/', authorize('MANAGER', 'ADMIN'), validate(listUsersSchema), userController.list);
router.get('/:id', authorize('MANAGER', 'ADMIN'), validate(userParamsSchema), userController.getById);
router.post('/', authorize('ADMIN'), validate(createUserSchema), userController.create);
router.patch('/:id', authorize('ADMIN'), validate(updateUserSchema), userController.update);
router.delete('/:id', authorize('ADMIN'), validate(userParamsSchema), userController.remove);

export default router;

