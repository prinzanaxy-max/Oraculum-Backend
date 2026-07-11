import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllReservations = async (req: Request, res: Response) => {
  try {
    const records = await prisma.reservation.findMany({
      include: { Book: true, Member: true }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
};

export const createReservation = async (req: Request, res: Response) => {
  try {
    const { bookId, memberId } = req.body;
    const record = await prisma.reservation.create({
      data: {
        bookId,
        memberId
      }
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create reservation' });
  }
};