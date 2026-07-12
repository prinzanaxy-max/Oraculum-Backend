import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const toFineResponse = (record: {
  id: string;
  memberId: string;
  fineAmount: number;
  dueDate: Date;
  fineStatus: string;
  Member: { name: string };
  Book: { title: string };
}) => ({
  id: record.id,
  memberId: record.memberId,
  memberName: record.Member.name,
  bookTitle: record.Book.title,
  amount: record.fineAmount,
  dueDate: record.dueDate.toISOString(),
  status: record.fineStatus,
});

const allowedStatuses = ['pending', 'paid', 'waived'];
const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const getFines = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' && allowedStatuses.includes(req.query.status)
      ? req.query.status
      : undefined;

    const records = await prisma.borrowRecord.findMany({
      where: {
        fineAmount: { gt: 0 },
        ...(status ? { fineStatus: status } : {}),
      },
      include: { Book: true, Member: true },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ fines: records.map(toFineResponse) });
  } catch (error) {
    console.error('Fetch fines error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const payFine = async (req: Request, res: Response) => {
  try {
    const fineId = getParam(req.params.id);
    if (!fineId) return res.status(400).json({ message: 'Fine ID is required' });

    const existing = await prisma.borrowRecord.findUnique({
      where: { id: fineId },
    });

    if (!existing || existing.fineAmount <= 0) {
      return res.status(404).json({ message: 'Fine not found' });
    }

    if (existing.fineStatus !== 'pending') {
      return res.status(409).json({ message: 'This fine is already resolved.' });
    }

    const record = await prisma.borrowRecord.update({
      where: { id: existing.id },
      data: { finePaid: true, fineStatus: 'paid' },
      include: { Book: true, Member: true },
    });

    res.json(toFineResponse(record));
  } catch (error) {
    console.error('Pay fine error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const waiveFine = async (req: Request, res: Response) => {
  try {
    const fineId = getParam(req.params.id);
    if (!fineId) return res.status(400).json({ message: 'Fine ID is required' });

    const existing = await prisma.borrowRecord.findUnique({
      where: { id: fineId },
    });

    if (!existing || existing.fineAmount <= 0) {
      return res.status(404).json({ message: 'Fine not found' });
    }

    if (existing.fineStatus !== 'pending') {
      return res.status(409).json({ message: 'This fine is already resolved.' });
    }

    const record = await prisma.borrowRecord.update({
      where: { id: existing.id },
      data: { finePaid: true, fineStatus: 'waived' },
      include: { Book: true, Member: true },
    });

    res.json(toFineResponse(record));
  } catch (error) {
    console.error('Waive fine error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};
