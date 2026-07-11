import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllBorrowRecords = async (req: Request, res: Response) => {
  try {
    const records = await prisma.borrowRecord.findMany({
      include: { Book: true, Member: true }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch borrow records' });
  }
};

export const createBorrowRecord = async (req: Request, res: Response) => {
  try {
    const { bookId, memberId, dueDate } = req.body;
    const record = await prisma.borrowRecord.create({
      data: {
        bookId,
        memberId,
        dueDate: new Date(dueDate)
      }
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create borrow record' });
  }
};