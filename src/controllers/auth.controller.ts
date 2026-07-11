import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt';
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

    const token = signToken({ id: user.id, email: user.email });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      }
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken({ id: user.id, email: user.email });

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    console.error("Login error:", error);
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