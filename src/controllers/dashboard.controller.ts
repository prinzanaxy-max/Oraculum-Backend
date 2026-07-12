import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

type RangeKey = 'last_7_days' | 'last_30_days' | 'last_6_months' | 'last_year' | 'all_time';
type Direction = 'up' | 'down' | 'neutral';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseLimit = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : fallback;
};

const subtractDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
};

const subtractMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
};

const getRangeWindow = (rangeParam: unknown) => {
  const range = (typeof rangeParam === 'string' ? rangeParam : 'last_6_months') as RangeKey;
  const now = new Date();

  if (range === 'all_time') {
    return {
      current: { start: new Date(0), end: now },
      previous: { start: new Date(0), end: new Date(0) },
    };
  }

  const start =
    range === 'last_7_days'
      ? subtractDays(now, 7)
      : range === 'last_30_days'
        ? subtractDays(now, 30)
        : range === 'last_year'
          ? subtractMonths(now, 12)
          : subtractMonths(now, 6);

  const previousStart =
    range === 'last_7_days'
      ? subtractDays(start, 7)
      : range === 'last_30_days'
        ? subtractDays(start, 30)
        : range === 'last_year'
          ? subtractMonths(start, 12)
          : subtractMonths(start, 6);

  return {
    current: { start, end: now },
    previous: { start: previousStart, end: start },
  };
};

const dateWhere = (start: Date, end: Date) => ({
  gte: start,
  lt: end,
});

const buildStat = (current: number, previous: number) => {
  const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
  const direction: Direction = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral';

  return {
    value: current,
    changePercent,
    direction,
  };
};

const formatDate = (date: Date | null) => {
  if (!date) {
    return null;
  }

  return date.toISOString().split('T')[0];
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { current, previous } = getRangeWindow(req.query.range);
    const borrowedStatus = req.query.status === 'active' ? 'BORROWED' : undefined;

    const borrowedBooks = await prisma.borrowRecord.count({
      where: {
        ...(borrowedStatus ? { status: borrowedStatus } : {}),
        borrowDate: dateWhere(current.start, current.end),
      },
    });
    const previousBorrowedBooks = await prisma.borrowRecord.count({
      where: {
        ...(borrowedStatus ? { status: borrowedStatus } : {}),
        borrowDate: dateWhere(previous.start, previous.end),
      },
    });
    const returnedBooks = await prisma.borrowRecord.count({
      where: {
        status: 'RETURNED',
        returnDate: dateWhere(current.start, current.end),
      },
    });
    const previousReturnedBooks = await prisma.borrowRecord.count({
      where: {
        status: 'RETURNED',
        returnDate: dateWhere(previous.start, previous.end),
      },
    });
    const overdueBooks = await prisma.borrowRecord.count({
      where: {
        status: 'OVERDUE',
        returnDate: null,
        dueDate: dateWhere(current.start, current.end),
      },
    });
    const previousOverdueBooks = await prisma.borrowRecord.count({
      where: {
        status: 'OVERDUE',
        returnDate: null,
        dueDate: dateWhere(previous.start, previous.end),
      },
    });
    const missingBooks = await prisma.book.count({
      where: { status: 'MISSING' },
    });
    const previousMissingBooks = await prisma.book.count({
      where: {
        status: 'MISSING',
        createdAt: dateWhere(previous.start, previous.end),
      },
    });
    const totalBooks = await prisma.book.aggregate({
      _sum: { totalCopies: true },
    });
    const previousTotalBooks = await prisma.book.aggregate({
      where: { createdAt: dateWhere(previous.start, previous.end) },
      _sum: { totalCopies: true },
    });
    const visitors = await prisma.visitorLog.count({
      where: { visitedAt: dateWhere(current.start, current.end) },
    });
    const previousVisitors = await prisma.visitorLog.count({
      where: { visitedAt: dateWhere(previous.start, previous.end) },
    });
    const newMembers = await prisma.member.count({
      where: { createdAt: dateWhere(current.start, current.end) },
    });
    const previousNewMembers = await prisma.member.count({
      where: { createdAt: dateWhere(previous.start, previous.end) },
    });
    const pendingFees = await prisma.borrowRecord.aggregate({
      where: {
        finePaid: false,
        createdAt: dateWhere(current.start, current.end),
      },
      _sum: { fineAmount: true },
    });
    const previousPendingFees = await prisma.borrowRecord.aggregate({
      where: {
        finePaid: false,
        createdAt: dateWhere(previous.start, previous.end),
      },
      _sum: { fineAmount: true },
    });

    const borrowedBooksStat = buildStat(borrowedBooks, previousBorrowedBooks);

    res.json({
      borrowRecords: borrowedBooksStat,
      borrowedBooks: borrowedBooksStat,
      returnedBooks: buildStat(returnedBooks, previousReturnedBooks),
      overdueBooks: buildStat(overdueBooks, previousOverdueBooks),
      missingBooks: buildStat(missingBooks, previousMissingBooks),
      totalBooks: buildStat(totalBooks._sum.totalCopies ?? 0, previousTotalBooks._sum.totalCopies ?? 0),
      visitors: buildStat(visitors, previousVisitors),
      newMembers: buildStat(newMembers, previousNewMembers),
      pendingFees: buildStat(pendingFees._sum.fineAmount ?? 0, previousPendingFees._sum.fineAmount ?? 0),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const getCheckoutStats = async (req: Request, res: Response) => {
  try {
    const { current } = getRangeWindow(req.query.range);
    const series = DAY_LABELS.map((day) => ({ day, borrowed: 0, returned: 0 }));

    const [borrowedRecords, returnedRecords] = await Promise.all([
      prisma.borrowRecord.findMany({
        where: { borrowDate: dateWhere(current.start, current.end) },
        select: { borrowDate: true },
      }),
      prisma.borrowRecord.findMany({
        where: {
          status: 'RETURNED',
          returnDate: dateWhere(current.start, current.end),
        },
        select: { returnDate: true },
      }),
    ]);

    borrowedRecords.forEach((record) => {
      series[record.borrowDate.getDay()].borrowed += 1;
    });

    returnedRecords.forEach((record) => {
      if (record.returnDate) {
        series[record.returnDate.getDay()].returned += 1;
      }
    });

    res.json({ series: [...series.slice(1), series[0]] });
  } catch (error) {
    console.error('Checkout stats error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const getOverdueHistory = async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit, 10);
    const records = await prisma.borrowRecord.findMany({
      where: {
        status: 'OVERDUE',
        returnDate: null,
        dueDate: { lt: new Date() },
      },
      include: {
        Book: {
          select: { title: true, isbn: true },
        },
        Member: {
          select: { memberCode: true, studentId: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    res.json({
      records: records.map((record) => ({
        memberCode: record.Member.memberCode ?? record.Member.studentId,
        title: record.Book.title,
        isbn: record.Book.isbn,
        dueDate: formatDate(record.dueDate),
        fineAmount: record.fineAmount,
      })),
    });
  } catch (error) {
    console.error('Overdue history error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const getRecentCheckouts = async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit, 10);
    const records = await prisma.borrowRecord.findMany({
      include: {
        Book: {
          select: { isbn: true, title: true, author: true },
        },
        Member: {
          select: { name: true },
        },
      },
      orderBy: { borrowDate: 'desc' },
      take: limit,
    });

    res.json({
      records: records.map((record, index) => ({
        id: `#${8924 + index}`,
        isbn: record.Book.isbn,
        title: record.Book.title,
        author: record.Book.author,
        member: record.Member.name,
        issuedDate: formatDate(record.borrowDate),
        returnDate: formatDate(record.returnDate ?? record.dueDate),
      })),
    });
  } catch (error) {
    console.error('Recent checkouts error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const getBooksPanel = async (req: Request, res: Response) => {
  try {
    const tab = req.query.tab === 'new' ? 'new' : 'top';
    const limit = parseLimit(req.query.limit, 10);
    const books = await prisma.book.findMany({
      include: {
        BorrowRecords: {
          select: {
            id: true,
            status: true,
            returnDate: true,
          },
        },
      },
      orderBy: tab === 'new' ? { createdAt: 'desc' } : undefined,
    });

    const sortedBooks =
      tab === 'top'
        ? books.sort((a, b) => b.BorrowRecords.length - a.BorrowRecords.length)
        : books;

    res.json({
      tab,
      books: sortedBooks.slice(0, limit).map((book) => {
        const checkedOutCopies = book.BorrowRecords.filter(
          (record) => !record.returnDate && ['BORROWED', 'OVERDUE'].includes(record.status),
        ).length;
        const availableCopies = Math.max(book.totalCopies - checkedOutCopies, 0);

        return {
          title: book.title,
          author: book.author,
          availableCopies,
          status: book.status === 'MISSING' ? 'Missing' : availableCopies > 0 ? 'Available' : 'Checked Out',
        };
      }),
    });
  } catch (error) {
    console.error('Books panel error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};