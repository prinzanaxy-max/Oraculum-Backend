import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  email: z.email('Invalid email address'),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
});

const updateMemberSchema = memberSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

const searchableFields = ['name', 'email', 'studentId', 'memberId', 'registerId'] as const;
type SearchableField = (typeof searchableFields)[number];

const toMemberResponse = (member: {
  id: string;
  memberCode: string | null;
  registerId: string | null;
  name: string;
  email: string;
  studentId: string;
  phone: string | null;
  department: string | null;
  isActive: boolean;
}) => ({
  id: member.id,
  memberId: member.memberCode,
  registerId: member.registerId,
  name: member.name,
  email: member.email,
  studentId: member.studentId,
  phone: member.phone,
  department: member.department,
  status: member.isActive ? 'active' : 'inactive',
});

const parseSearchFields = (fieldsParam: unknown): SearchableField[] => {
  if (typeof fieldsParam !== 'string' || !fieldsParam.trim()) {
    return [...searchableFields];
  }

  const requestedFields = fieldsParam
    .split(',')
    .map((field) => field.trim())
    .filter((field): field is SearchableField => searchableFields.includes(field as SearchableField));

  return requestedFields.length ? requestedFields : [...searchableFields];
};

const buildSearchWhere = (query: unknown, fieldsParam: unknown) => {
  if (typeof query !== 'string' || !query.trim()) {
    return undefined;
  }

  const search = query.trim();
  const fields = parseSearchFields(fieldsParam);

  return {
    OR: fields.map((field) => {
      const prismaField = field === 'memberId' ? 'memberCode' : field;

      return {
        [prismaField]: {
          contains: search,
          mode: 'insensitive' as const,
        },
      };
    }),
  };
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const nextIdentifier = async (prefix: string, field: 'memberCode' | 'registerId') => {
  let latestValue: string | null | undefined;

  if (field === 'memberCode') {
    const latest = await prisma.member.findFirst({
      where: { memberCode: { startsWith: `${prefix}-` } },
      orderBy: { memberCode: 'desc' },
      select: { memberCode: true },
    });
    latestValue = latest?.memberCode;
  } else {
    const latest = await prisma.member.findFirst({
      where: { registerId: { startsWith: `${prefix}-` } },
      orderBy: { registerId: 'desc' },
      select: { registerId: true },
    });
    latestValue = latest?.registerId;
  }

  const latestNumber = latestValue ? Number(latestValue.split('-')[1]) : 0;
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
};

export const getAllMembers = async (req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      where: buildSearchWhere(req.query.query, req.query.fields),
      orderBy: { createdAt: 'desc' },
    });

    res.json({ members: members.map(toMemberResponse) });
  } catch (error) {
    console.error('Fetch members error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const createMember = async (req: Request, res: Response) => {
  try {
    const data = memberSchema.parse(req.body);
    const [memberCode, registerId] = await Promise.all([
      nextIdentifier('MEM', 'memberCode'),
      nextIdentifier('REG', 'registerId'),
    ]);

    const member = await prisma.member.create({
      data: {
        ...data,
        memberCode,
        registerId,
      },
    });

    res.status(201).json(toMemberResponse(member));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A member with this email or student ID already exists.' });
    }

    console.error('Create member error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const updateMember = async (req: Request, res: Response) => {
  try {
    const memberId = getParam(req.params.id);
    if (!memberId) {
      return res.status(400).json({ message: 'Member ID is required' });
    }

    const data = updateMemberSchema.parse(req.body);
    const member = await prisma.member.update({
      where: { id: memberId },
      data,
    });

    res.json(toMemberResponse(member));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: (error as any).issues?.[0]?.message || 'Invalid request' });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A member with this email or student ID already exists.' });
    }

    console.error('Update member error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const deleteMember = async (req: Request, res: Response) => {
  try {
    const memberId = getParam(req.params.id);
    if (!memberId) {
      return res.status(400).json({ message: 'Member ID is required' });
    }

    const activeBorrows = await prisma.borrowRecord.count({
      where: {
        memberId,
        returnDate: null,
        status: { in: ['BORROWED', 'OVERDUE'] },
      },
    });

    if (activeBorrows > 0) {
      return res.status(409).json({ message: 'This member has active borrows and cannot be removed.' });
    }

    const [borrowHistory, reservations] = await Promise.all([
      prisma.borrowRecord.count({ where: { memberId } }),
      prisma.reservation.count({ where: { memberId } }),
    ]);

    if (borrowHistory > 0 || reservations > 0) {
      return res.status(409).json({ message: 'This member has borrowing or reservation history and cannot be removed.' });
    }

    await prisma.member.delete({
      where: { id: memberId },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Member not found' });
    }

    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};