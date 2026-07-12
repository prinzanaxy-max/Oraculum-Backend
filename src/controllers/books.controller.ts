import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { BookStatus } from '../generated/prisma';
import { z } from 'zod';

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  isbn: z.string().min(1, 'ISBN is required'),
  publishedYear: z.coerce.number().int().optional(),
  category: z.string().min(1, 'Category is required'),
  copies: z.coerce.number().int().min(0).optional(),
  totalCopies: z.coerce.number().int().min(0).optional(),
  shelfLocation: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['available', 'borrowed', 'reserved', 'maintenance']).optional(),
});

const updateBookSchema = bookSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

const mapBookStatusToDb = (status?: string) => {
  if (status === 'borrowed') return BookStatus.BORROWED;
  if (status === 'reserved') return BookStatus.RESERVED;
  if (status === 'maintenance') return BookStatus.MAINTENANCE;
  return BookStatus.AVAILABLE;
};

const mapBookStatusToApi = (status: string) => {
  if (status === 'BORROWED') return 'borrowed';
  if (status === 'RESERVED') return 'reserved';
  if (status === 'MAINTENANCE' || status === 'MISSING') return 'maintenance';
  return 'available';
};

const toBookResponse = (book: {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publishedYear: number;
  category: string;
  totalCopies: number;
  shelfLocation: string | null;
  description: string | null;
  status: string;
  BorrowRecords?: { id: string; returnDate: Date | null; status: string }[];
}) => {
  const checkedOutCopies = (book.BorrowRecords || []).filter(
    (record) => !record.returnDate && ['BORROWED', 'OVERDUE', 'RENEWED'].includes(record.status),
  ).length;
  const availableCopies = Math.max(book.totalCopies - checkedOutCopies, 0);

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publishedYear: book.publishedYear,
    category: book.category,
    copies: book.totalCopies,
    availableCopies,
    shelfLocation: book.shelfLocation,
    description: book.description,
    status: availableCopies <= 0 ? 'borrowed' : mapBookStatusToApi(book.status),
  };
};

const buildBookSearchWhere = (query: unknown, fieldsParam: unknown) => {
  if (typeof query !== 'string' || !query.trim()) return undefined;

  const allowedFields = ['title', 'author', 'isbn', 'category'];
  const requestedFields =
    typeof fieldsParam === 'string' && fieldsParam.trim()
      ? fieldsParam.split(',').map((field) => field.trim()).filter((field) => allowedFields.includes(field))
      : allowedFields;
  const fields = requestedFields.length ? requestedFields : allowedFields;

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: query.trim(),
        mode: 'insensitive' as const,
      },
    })),
  };
};

const toBookCreateData = (data: z.infer<typeof bookSchema>) => ({
  title: data.title,
  author: data.author,
  isbn: data.isbn,
  publishedYear: data.publishedYear ?? new Date().getFullYear(),
  category: data.category,
  totalCopies: data.copies ?? data.totalCopies ?? 1,
  shelfLocation: data.shelfLocation,
  description: data.description,
  status: mapBookStatusToDb(data.status),
});

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const books = await prisma.book.findMany({
      where: buildBookSearchWhere(req.query.query, req.query.fields),
      include: {
        BorrowRecords: {
          select: { id: true, returnDate: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ books: books.map(toBookResponse) });
  } catch (error) {
    console.error('Fetch books error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const createBook = async (req: Request, res: Response) => {
  try {
    const data = bookSchema.parse(req.body);
    const book = await prisma.book.create({
      data: toBookCreateData(data),
      include: {
        BorrowRecords: {
          select: { id: true, returnDate: true, status: true },
        },
      },
    });

    res.status(201).json(toBookResponse(book));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A book with this ISBN already exists.' });
    }

    console.error('Create book error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const updateBook = async (req: Request, res: Response) => {
  try {
    const data = updateBookSchema.parse(req.body);
    const bookId = getParam(req.params.id);
    if (!bookId) return res.status(400).json({ message: 'Book ID is required' });

    const book = await prisma.book.update({
      where: { id: bookId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.author !== undefined ? { author: data.author } : {}),
        ...(data.isbn !== undefined ? { isbn: data.isbn } : {}),
        ...(data.publishedYear !== undefined ? { publishedYear: data.publishedYear } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.copies !== undefined || data.totalCopies !== undefined ? { totalCopies: data.copies ?? data.totalCopies } : {}),
        ...(data.shelfLocation !== undefined ? { shelfLocation: data.shelfLocation } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: mapBookStatusToDb(data.status) } : {}),
      },
      include: {
        BorrowRecords: {
          select: { id: true, returnDate: true, status: true },
        },
      },
    });

    res.json(toBookResponse(book));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A book with this ISBN already exists.' });
    }

    console.error('Update book error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const deleteBook = async (req: Request, res: Response) => {
  try {
    const bookId = getParam(req.params.id);
    if (!bookId) return res.status(400).json({ message: 'Book ID is required' });

    const activeBorrows = await prisma.borrowRecord.count({
      where: {
        bookId,
        returnDate: null,
        status: { in: ['BORROWED', 'OVERDUE', 'RENEWED'] },
      },
    });

    if (activeBorrows > 0) {
      return res.status(409).json({ message: 'This book has active borrows and cannot be removed.' });
    }

    const [borrowHistory, reservations] = await Promise.all([
      prisma.borrowRecord.count({ where: { bookId } }),
      prisma.reservation.count({ where: { bookId } }),
    ]);

    if (borrowHistory > 0 || reservations > 0) {
      return res.status(409).json({ message: 'This book has borrowing or reservation history and cannot be removed.' });
    }

    await prisma.book.delete({
      where: { id: bookId },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Book not found' });
    }

    console.error('Delete book error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};