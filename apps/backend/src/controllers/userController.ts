import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middlewares/authMiddleware';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config(); //
// 1. Khai báo Transporter bên ngoài Object để dùng chung
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com', // Thêm dòng này cho chắc chắn
  port: 465,
  secure: true,
  auth: {
    // Đảm bảo tên biến này khớp 100% với file .env
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS,
  },
});
export const userController = {
  // 1. Lấy thông tin cá nhân
  getProfile: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true }
      });
      res.status(200).json({ status: "success", data: user });
    } catch (error) {
      res.status(500).json({ message: "Lỗi lấy dữ liệu" });
    }
  },

  // 2. Cập nhật thông tin cá nhân
  updateProfile: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ message: "Không tìm thấy ID" });

      const { fullName, email } = req.body;
      const updatedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: { fullName, email }
      });
      res.status(200).json({ status: "success", data: updatedUser });
    } catch (error: any) {
      res.status(400).json({ status: "error", message: "Cập nhật thất bại" });
    }
  },

  // 3. Đổi mật khẩu (Khi đang đăng nhập)
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
  },

  // 4. Quên mật khẩu - Gửi mã OTP qua Mail thật
  forgotPassword: async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const user = await (prisma as any).user.findUnique({ 
        where: { email: email.toLowerCase().trim() } 
      });

      if (!user) return res.status(404).json({ message: "Email không tồn tại!" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await (prisma as any).user.update({
        where: { email: email.toLowerCase().trim() },
        data: {
          passwordResetToken: otp,
          passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000) 
        }
      });

      // Gửi Mail thật
      await transporter.sendMail({
        from: '"Phố Ẩm Thực" <no-reply@phoamthuc.com>',
        to: email,
        subject: "Mã xác thực khôi phục mật khẩu",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FF6F00;">Xác thực tài khoản Phố Ẩm Thực</h2>
            <p>Xin chào,</p>
            <p>Mã OTP để khôi phục mật khẩu của bạn là:</p>
            <h1 style="color: #FF6F00; letter-spacing: 5px;">${otp}</h1>
            <p>Mã này có hiệu lực trong <b>10 phút</b>. Vui lòng không cung cấp mã này cho người khác.</p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">Đây là email tự động, vui lòng không phản hồi.</p>
          </div>
        `
      });

      // Vẫn log ra terminal để sơ cua khi Demo
      console.log(`OTP cho ${email}: ${otp}`);

      res.status(200).json({ status: "success", message: "Mã OTP đã được gửi vào Email!" });
    } catch (error: any) {
      console.error("Lỗi gửi mail:", error);
      res.status(500).json({ message: "Lỗi gửi mail: " + error.message });
    }
  },

  // 5. Quên mật khẩu - Xác nhận OTP và reset mật khẩu
  resetPassword: async (req: Request, res: Response) => {
    try {
      const { email, otp, newPassword } = req.body;

      const user = await (prisma as any).user.findFirst({
        where: { 
          email: email.toLowerCase().trim(), 
          passwordResetToken: otp,
          passwordResetExpires: { gt: new Date() } 
        }
      });

      if (!user) {
        return res.status(400).json({ message: "Mã OTP không đúng hoặc đã hết hạn!" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await (prisma as any).user.update({
        where: { email: email.toLowerCase().trim() },
        data: {
          passwordHash: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });

      res.status(200).json({ status: "success", message: "Đổi mật khẩu thành công!" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi khôi phục mật khẩu" });
    }
  }
};