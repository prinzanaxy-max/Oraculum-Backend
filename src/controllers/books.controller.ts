import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const books = await prisma.book.findMany();
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
};

export const createBook = async (req: Request, res: Response) => {
  try {
    const book = await prisma.book.create({
      data: req.body
    });
    res.status(201).json(book);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create book' });
  }
};