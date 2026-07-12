import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { verifyGoogleToken } from '../utils/googleAuth';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const signupSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  studentStaffId: z.string().min(1, "Student/Staff ID is required").optional(),
  studentId: z.string().min(1, "Student ID is required").optional(),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string().optional()
}).refine((data) => data.confirmPassword === undefined || data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => Boolean(data.studentStaffId || data.studentId), {
  message: "Student ID is required",
  path: ["studentId"],
});

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string()
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.email('Invalid email address'),
});

const updateMeSchema = z.object({
  fullName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = refreshTokenSchema;

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const hashRefreshToken = (refreshToken: string) => {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
};

const toPublicUser = (user: { id: string; fullName: string; email: string; phone?: string | null; avatarUrl?: string | null }) => ({
  id: user.id,
  name: user.fullName,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone ?? null,
  avatarUrl: user.avatarUrl ?? null,
});

const issueTokenPair = async (user: { id: string; email: string }) => {
  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: addDays(7),
    },
  });

  return {
    accessToken,
    refreshToken,
    token: accessToken,
    tokenType: 'Bearer',
    expiresIn: 15 * 60,
  };
};

export const signup = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = signupSchema.parse(req.body);
    const { fullName, email, password } = validatedData;
    const studentStaffId = validatedData.studentStaffId ?? validatedData.studentId!;

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      return res.status(409).json({ message: 'Email is already taken' });
    }

    const existingUserById = await prisma.user.findUnique({
      where: { studentStaffId },
    });

    if (existingUserById) {
      return res.status(409).json({ message: 'Student/Staff ID is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        studentStaffId,
        email,
        passwordHash,
      },
    });

    const tokens = await issueTokenPair(user);

    return res.status(201).json({
      ...tokens,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const register = signup;

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.passwordHash && user.authProvider === 'google') {
      return res.status(400).json({ message: 'This account uses Google sign-in. Please continue with Google.' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokens = await issueTokenPair(user);

    return res.json({
      ...tokens,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }
    console.error("Login error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const googleSignIn = async (req: Request, res: Response): Promise<any> => {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);
    const googleUser = await verifyGoogleToken(idToken);

    if (!googleUser.emailVerified) {
      return res.status(403).json({ message: 'Google account email is not verified' });
    }

    let user = await prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (!user) {
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (existingUserByEmail) {
        user = await prisma.user.update({
          where: { id: existingUserByEmail.id },
          data: {
            googleId: googleUser.googleId,
            authProvider: existingUserByEmail.passwordHash ? 'local' : 'google',
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            fullName: googleUser.name,
            studentStaffId: `GOOGLE-${googleUser.googleId}`,
            email: googleUser.email,
            googleId: googleUser.googleId,
            authProvider: 'google',
          },
        });
      }
    }

    const tokens = await issueTokenPair(user);

    return res.json({
      ...tokens,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }
    console.error("Google sign-in error:", error);
    return res.status(401).json({ message: 'Invalid Google token' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    forgotPasswordSchema.parse(req.body);
    return res.status(204).send();
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    console.error("Forgot password error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        User: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date() || storedToken.userId !== payload.id) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokenPair(storedToken.User);

    return res.json({
      ...tokens,
      user: toPublicUser(storedToken.User),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }
    console.error("Refresh token error:", error);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }
    console.error("Logout error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        studentStaffId: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Get /me error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const data = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(data.fullName !== undefined || data.name !== undefined ? { fullName: data.fullName ?? data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });

    return res.json({ user: toPublicUser(user) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    console.error("Update me error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'This account uses Google sign-in. Please continue with Google.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    console.error("Change password error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};