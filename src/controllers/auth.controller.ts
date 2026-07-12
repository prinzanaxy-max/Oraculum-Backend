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
  studentStaffId: z.string().min(1, "Student/Staff ID is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string()
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
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

const toPublicUser = (user: { id: string; fullName: string; email: string }) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
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
    const { fullName, studentStaffId, email, password } = validatedData;

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
      return res.status(400).json({ errors: (error as any).errors });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

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
      return res.status(400).json({ errors: (error as any).errors });
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
      return res.status(400).json({ errors: (error as any).errors });
    }
    console.error("Google sign-in error:", error);
    return res.status(401).json({ message: 'Invalid Google token' });
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
      return res.status(400).json({ errors: (error as any).errors });
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
      return res.status(400).json({ errors: (error as any).errors });
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