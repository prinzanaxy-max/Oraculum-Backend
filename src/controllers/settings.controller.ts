import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const settingsSchema = z.object({
  loanPeriodDays: z.coerce.number().int().min(1),
  finePerDay: z.coerce.number().min(0),
  maxReservationsPerMember: z.coerce.number().int().min(0),
  autoNotifyOverdue: z.boolean(),
});

const defaultSettings = {
  loanPeriodDays: Number(process.env.LOAN_PERIOD_DAYS) || 14,
  finePerDay: Number(process.env.FINE_PER_DAY) || 1,
  maxReservationsPerMember: 5,
  autoNotifyOverdue: true,
};

const toSettingsResponse = (settings: typeof defaultSettings) => ({
  loanPeriodDays: settings.loanPeriodDays,
  finePerDay: settings.finePerDay,
  maxReservationsPerMember: settings.maxReservationsPerMember,
  autoNotifyOverdue: settings.autoNotifyOverdue,
});

export const getLibrarySettings = async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.librarySettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...defaultSettings },
      update: {},
    });

    res.json(toSettingsResponse(settings));
  } catch (error) {
    console.error('Get library settings error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const updateLibrarySettings = async (req: Request, res: Response) => {
  try {
    const data = settingsSchema.parse(req.body);
    const settings = await prisma.librarySettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });

    res.json(toSettingsResponse(settings));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    console.error('Update library settings error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};
