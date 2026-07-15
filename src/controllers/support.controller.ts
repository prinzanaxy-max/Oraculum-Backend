import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { sendSupportContactEmail } from '../utils/email';

const contactSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
});

export const createSupportContact = async (req: AuthRequest, res: Response) => {
  try {
    const data = contactSchema.parse(req.body);

    const supportRequest = await prisma.supportRequest.create({
      data: {
        subject: data.subject,
        message: data.message,
        userId: req.userId,
        userEmail: req.userEmail,
      },
    });

    try {
      await sendSupportContactEmail({
        requestId: supportRequest.id,
        subject: supportRequest.subject,
        message: supportRequest.message,
        userId: supportRequest.userId,
        userEmail: supportRequest.userEmail,
      });
    } catch (emailError) {
      console.error('Support request saved but email delivery failed:', emailError);
    }

    res.status(201).json({ message: 'Support request received' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    console.error('Create support contact error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};
