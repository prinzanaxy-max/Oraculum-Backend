import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const reservationSchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
});

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const mapReservationStatusToApi = (status: string) => {
  if (status === 'FULFILLED') return 'fulfilled';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'READY_FOR_PICKUP') return 'ready_for_pickup';
  return 'pending';
};

const mapReservationStatusToDb = (status?: unknown) => {
  if (status === 'fulfilled') return 'FULFILLED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'ready_for_pickup' || status === 'ready-for-pickup') return 'READY_FOR_PICKUP';
  if (status === 'pending') return 'PENDING';
  return undefined;
};

const toReservationResponse = (record: {
  id: string;
  bookId: string;
  memberId: string;
  reservedAt: Date;
  status: string;
  queuePosition: number;
  readyForPickupAt: Date | null;
  pickupExpiresAt: Date | null;
  Book?: { title: string };
  Member?: { name: string; memberCode: string | null; studentId: string };
}) => ({
  id: record.id,
  bookId: record.bookId,
  memberId: record.memberId,
  bookTitle: record.Book?.title,
  memberName: record.Member?.name,
  memberCode: record.Member?.memberCode ?? record.Member?.studentId,
  reservationDate: record.reservedAt.toISOString(),
  queuePosition: record.queuePosition,
  readyForPickupAt: record.readyForPickupAt?.toISOString() ?? null,
  pickupExpiresAt: record.pickupExpiresAt?.toISOString() ?? null,
  status: mapReservationStatusToApi(record.status),
});

export const getAllReservations = async (req: Request, res: Response) => {
  try {
    const status = mapReservationStatusToDb(req.query.status);
    const records = await prisma.reservation.findMany({
      where: status ? { status } : undefined,
      include: { Book: true, Member: true },
      orderBy: { reservedAt: 'desc' },
    });

    res.json({ reservations: records.map(toReservationResponse) });
  } catch (error) {
    console.error('Fetch reservations error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const createReservation = async (req: Request, res: Response) => {
  try {
    const { bookId, memberId } = reservationSchema.parse(req.body);
    const [book, member, existingReservation] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.member.findUnique({ where: { id: memberId } }),
      prisma.reservation.findFirst({
        where: { bookId, memberId, status: { in: ['PENDING', 'READY_FOR_PICKUP'] } },
      }),
    ]);

    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (existingReservation) return res.status(409).json({ message: 'This member already has an active reservation for this book.' });

    const queuePosition = await prisma.reservation.count({
      where: { bookId, status: { in: ['PENDING', 'READY_FOR_PICKUP'] } },
    });

    const record = await prisma.reservation.create({
      data: {
        bookId,
        memberId,
        queuePosition: queuePosition + 1,
        status: 'PENDING',
      },
      include: { Book: true, Member: true },
    });

    res.status(201).json(toReservationResponse(record));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    console.error('Create reservation error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const cancelReservation = async (req: Request, res: Response) => {
  try {
    const reservationId = getParam(req.params.id);
    if (!reservationId) return res.status(400).json({ message: 'Reservation ID is required' });

    const existing = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!existing) return res.status(404).json({ message: 'Reservation not found' });
    if (existing.status === 'FULFILLED') return res.status(409).json({ message: 'Fulfilled reservations cannot be cancelled.' });
    if (existing.status === 'CANCELLED') return res.status(409).json({ message: 'Reservation is already cancelled.' });

    const record = await prisma.reservation.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
      include: { Book: true, Member: true },
    });

    res.json(toReservationResponse(record));
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};