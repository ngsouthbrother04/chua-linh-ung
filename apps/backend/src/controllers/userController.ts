import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middlewares/authMiddleware';

export const userController = {
  getProfile: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true } // Chỉ lấy tên và email
      });

      res.status(200).json({ status: "success", data: user });
    } catch (error) {
      res.status(500).json({ message: "Lỗi lấy dữ liệu" });
    }
  },
  updateProfile: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Không tìm thấy ID trong Token" });
      }

      const { fullName, email } = req.body;

      const updatedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: {
          fullName: fullName,
          email: email
        }
      });

      res.status(200).json({ status: "success", data: updatedUser });
    } catch (error: any) {
      console.error("Update Profile Error:", error);
      res.status(400).json({ status: "error", message: "Cập nhật thất bại" });
    }
  },

  changePassword: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const { oldPassword, newPassword } = req.body;

      const user = await (prisma as any).user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash || "");
      if (!isMatch) return res.status(400).json({ message: "Mật khẩu cũ không chính xác" });

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await (prisma as any).user.update({
        where: { id: userId },
        data: { passwordHash: newHash }
      });

      res.status(200).json({ status: "success", message: "Đổi mật khẩu thành công" });
    } catch (error: any) {
      res.status(500).json({ message: "Lỗi hệ thống" });
    }
  }
};