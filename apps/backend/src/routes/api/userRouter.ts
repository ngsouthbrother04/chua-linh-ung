import { Router } from 'express';
import { userController } from '../../controllers/userController';
import { requireAuth } from '../../middlewares/authMiddleware'; // Dùng đúng tên hàm bạn vừa gửi

const router = Router();

// PATCH /api/v1/users/profile
router.patch('/profile', requireAuth, userController.updateProfile);

// POST /api/v1/users/change-password
router.post('/change-password', requireAuth, userController.changePassword);
// Thêm route lấy thông tin cá nhân (GET)
router.get('/profile', requireAuth, userController.getProfile);
export default router;