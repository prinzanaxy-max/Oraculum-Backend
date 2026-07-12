import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { calculateFine } from '../utils/fine';
import { z } from 'zod';

const borrowSchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
});

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDate = (date: Date | null) => (date ? date.toISOString() : null);
const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const toBorrowResponse = (record: {
  id: string;
  bookId: string;
  memberId: string;
  borrowDate: Date;
  dueDate: Date;
  returnDate: Date | null;
  status: string;
  fineAmount: number;
  Book: { isbn: string; title: string; author: string };
  Member: { name: string };
  hasPendingReservations?: boolean;
}) => ({
  id: record.id,
  isbn: record.Book.isbn,
  bookId: record.bookId,
  memberId: record.memberId,
  memberName: record.Member.name,
  title: record.Book.title,
  author: record.Book.author,
  borrowedDate: formatDate(record.borrowDate),
  dueDate: formatDate(record.dueDate),
  returnedDate: formatDate(record.returnDate),
  status: record.status === 'RENEWED' ? 'renewed' : record.returnDate ? 'available' : 'borrowed',
  hasPendingReservations: record.hasPendingReservations ?? false,
  fine: record.fineAmount,
});

const buildBorrowSearchWhere = (query: unknown, fieldsParam: unknown) => {
  if (typeof query !== 'string' || !query.trim()) return undefined;

  const allowedFields = ['isbn', 'title', 'author', 'member'];
  const requestedFields =
    typeof fieldsParam === 'string' && fieldsParam.trim()
      ? fieldsParam.split(',').map((field) => field.trim()).filter((field) => allowedFields.includes(field))
      : allowedFields;
  const fields = requestedFields.length ? requestedFields : allowedFields;
  const search = query.trim();

  return {
    OR: fields.map((field) => {
      if (field === 'member') {
        return { Member: { name: { contains: search, mode: 'insensitive' as const } } };
      }

      return { Book: { [field]: { contains: search, mode: 'insensitive' as const } } };
    }),
  };
};

export const getAllBorrowRecords = async (req: Request, res: Response) => {
  try {
    const records = await prisma.borrowRecord.findMany({
      where: buildBorrowSearchWhere(req.query.query, req.query.fields),
      include: { Book: true, Member: true },
      orderBy: { borrowDate: 'desc' },
    });

    const reservationCounts = await prisma.reservation.groupBy({
      by: ['bookId'],
      where: {
        bookId: { in: records.map((record) => record.bookId) },
        status: 'PENDING',
      },
      _count: true,
    });
    const pendingReservationBookIds = new Set(reservationCounts.map((reservation) => reservation.bookId));

    res.json({
      records: records.map((record) =>
        toBorrowResponse({
          ...record,
          hasPendingReservations: pendingReservationBookIds.has(record.bookId),
        }),
      ),
    });
  } catch (error) {
    console.error('Fetch borrow records error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const createBorrowRecord = async (req: Request, res: Response) => {
  try {
    const { bookId, memberId } = borrowSchema.parse(req.body);
    const [book, member, activeBorrowCount] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.member.findUnique({ where: { id: memberId } }),
      prisma.borrowRecord.count({
        where: {
          bookId,
          returnDate: null,
          status: { in: ['BORROWED', 'OVERDUE', 'RENEWED'] },
        },
      }),
    ]);

    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (!member.isActive) return res.status(409).json({ message: 'This member is inactive and cannot borrow books.' });
    if (book.status === 'MISSING' || book.status === 'MAINTENANCE') {
      return res.status(409).json({ message: 'This book is not available for checkout.' });
    }
    if (activeBorrowCount >= book.totalCopies) {
      return res.status(409).json({ message: 'No available copies for this book.' });
    }

    const borrowDate = new Date();
    const dueDate = addDays(borrowDate, Number(process.env.LOAN_PERIOD_DAYS) || 14);
    const record = await prisma.borrowRecord.create({
      data: {
        bookId,
        memberId,
        borrowDate,
        dueDate,
        status: 'BORROWED',
      },
      include: { Book: true, Member: true },
    });

    res.status(201).json({ record: toBorrowResponse(record) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    console.error('Create borrow record error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const returnBorrowRecord = async (req: Request, res: Response) => {
  try {
    const borrowId = getParam(req.params.id);
    if (!borrowId) return res.status(400).json({ message: 'Borrow record ID is required' });

    const existing = await prisma.borrowRecord.findUnique({
      where: { id: borrowId },
      include: { Book: true, Member: true },
    });

    if (!existing) return res.status(404).json({ message: 'Borrow record not found' });
    if (existing.returnDate) return res.status(409).json({ message: 'This borrow record has already been returned.' });

    const returnedAt = new Date();
    const fineAmount = calculateFine(existing.dueDate, returnedAt);
    const record = await prisma.borrowRecord.update({
      where: { id: existing.id },
      data: {
        returnDate: returnedAt,
        status: 'RETURNED',
        fineAmount,
        fineStatus: fineAmount > 0 ? 'pending' : 'paid',
        finePaid: fineAmount === 0,
      },
      include: { Book: true, Member: true },
    });

    res.json({ record: toBorrowResponse(record) });
  } catch (error) {
    console.error('Return borrow record error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const renewBorrowRecord = async (req: Request, res: Response) => {
  try {
    const borrowId = getParam(req.params.id);
    if (!borrowId) return res.status(400).json({ message: 'Borrow record ID is required' });

    const existing = await prisma.borrowRecord.findUnique({
      where: { id: borrowId },
      include: { Book: true, Member: true },
    });

    if (!existing) return res.status(404).json({ message: 'Borrow record not found' });
    if (existing.returnDate) return res.status(409).json({ message: 'Returned records cannot be renewed.' });

    const pendingReservations = await prisma.reservation.count({
      where: { bookId: existing.bookId, status: 'PENDING' },
    });
    if (pendingReservations > 0) {
      return res.status(409).json({ message: 'This book has pending reservations and cannot be renewed.' });
    }

    const record = await prisma.borrowRecord.update({
      where: { id: existing.id },
      data: {
        dueDate: addDays(existing.dueDate, Number(process.env.LOAN_PERIOD_DAYS) || 14),
        status: 'RENEWED',
      },
      include: { Book: true, Member: true },
    });

    res.json({ record: toBorrowResponse(record) });
  } catch (error) {
    console.error('Renew borrow record error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};