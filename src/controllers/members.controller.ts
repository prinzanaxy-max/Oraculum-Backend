import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllMembers = async (req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
};

export const createMember = async (req: Request, res: Response) => {
  try {
    const member = await prisma.member.create({
      data: req.body
    });
    res.status(201).json(member);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create member' });
  }
};