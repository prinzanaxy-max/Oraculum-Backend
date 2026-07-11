import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const calculateFine = (dueDate: Date, returnDate = new Date()) => {
  const finePerDay = Number(process.env.FINE_PER_DAY) || 1;

  if (returnDate <= dueDate) {
    return 0;
  }

  const overdueDays = Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  return overdueDays * finePerDay;
};

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME;

  if (!adminEmail || !adminPassword || !adminName) {
    console.error('Missing Admin environment variables.');
    return;
  }

  const existingAdmin = await prisma.admin.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.admin.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
      },
    });
    console.log(`Admin created: ${admin.email}`);
  } else {
    console.log(`Admin already exists: ${existingAdmin.email}`);
  }

  await prisma.reservation.deleteMany();
  await prisma.borrowRecord.deleteMany();
  await prisma.visitorLog.deleteMany();
  await prisma.member.deleteMany();
  await prisma.book.deleteMany();

  const books = await Promise.all(
    [
      {
        title: 'The Midnight Library',
        author: 'Matt Haig',
        isbn: '978-0525559474',
        category: 'Fiction',
        publishedYear: 2020,
        totalCopies: 4,
        description: 'A novel about choices, regrets, and second chances.',
        createdAt: daysAgo(8),
      },
      {
        title: 'Atomic Habits',
        author: 'James Clear',
        isbn: '978-0735211292',
        category: 'Self Development',
        publishedYear: 2018,
        totalCopies: 3,
        description: 'A practical guide to building better habits.',
        createdAt: daysAgo(12),
      },
      {
        title: 'Dune',
        author: 'Frank Herbert',
        isbn: '978-0441172719',
        category: 'Science Fiction',
        publishedYear: 1965,
        totalCopies: 2,
        description: 'Epic science fiction set on the desert planet Arrakis.',
        createdAt: daysAgo(18),
      },
      {
        title: 'Project Hail Mary',
        author: 'Andy Weir',
        isbn: '978-0593135204',
        category: 'Science Fiction',
        publishedYear: 2021,
        totalCopies: 3,
        description: 'A lone astronaut races to save humanity.',
        createdAt: daysAgo(22),
      },
      {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '978-0743273565',
        category: 'Classic',
        publishedYear: 1925,
        totalCopies: 2,
        description: 'A portrait of wealth and longing in the Jazz Age.',
        createdAt: daysAgo(45),
      },
      {
        title: '1984',
        author: 'George Orwell',
        isbn: '978-0451524935',
        category: 'Classic',
        publishedYear: 1949,
        totalCopies: 3,
        description: 'A dystopian novel about surveillance and control.',
        createdAt: daysAgo(52),
      },
      {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '978-0060935467',
        category: 'Classic',
        publishedYear: 1960,
        totalCopies: 2,
        description: 'A story of justice and childhood in the American South.',
        createdAt: daysAgo(80),
      },
      {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        isbn: '978-0061120084',
        category: 'Classic',
        publishedYear: 1813,
        totalCopies: 2,
        description: 'A witty romance about manners, pride, and first impressions.',
        createdAt: daysAgo(96),
      },
      {
        title: 'The Catcher in the Rye',
        author: 'J.D. Salinger',
        isbn: '978-0316769488',
        category: 'Classic',
        publishedYear: 1951,
        totalCopies: 2,
        description: 'A landmark coming-of-age novel.',
        createdAt: daysAgo(120),
      },
      {
        title: 'Frankenstein',
        author: 'Mary Shelley',
        isbn: '978-0141439471',
        category: 'Gothic Fiction',
        publishedYear: 1818,
        totalCopies: 1,
        description: 'A foundational work of science fiction and gothic horror.',
        status: 'MISSING' as const,
        createdAt: daysAgo(150),
      },
    ].map((book) =>
      prisma.book.create({
        data: book,
      }),
    ),
  );

  const members = await Promise.all(
    [
      ['M-1024', 'STF-1024', 'Sarah Jenkins', 'sarah.jenkins@oraculum.edu.gh', 'Library Science'],
      ['M-2045', 'STF-2045', 'David Chen', 'david.chen@oraculum.edu.gh', 'Computer Science'],
      ['M-3012', 'STF-3012', 'Emily Rodriguez', 'emily.rodriguez@oraculum.edu.gh', 'English'],
      ['M-1899', 'STF-1899', 'Michael Chang', 'michael.chang@oraculum.edu.gh', 'History'],
      ['M-2241', 'STF-2241', 'Ama Mensah', 'ama.mensah@oraculum.edu.gh', 'Business'],
      ['M-3378', 'STF-3378', 'Kwame Boateng', 'kwame.boateng@oraculum.edu.gh', 'Engineering'],
      ['M-4120', 'STF-4120', 'Nadia Owusu', 'nadia.owusu@oraculum.edu.gh', 'Law'],
      ['M-5267', 'STF-5267', 'Ethan Brooks', 'ethan.brooks@oraculum.edu.gh', 'Medicine'],
      ['M-6382', 'STF-6382', 'Aisha Bello', 'aisha.bello@oraculum.edu.gh', 'Education'],
      ['M-7409', 'STF-7409', 'Noah Williams', 'noah.williams@oraculum.edu.gh', 'Economics'],
    ].map(([memberCode, studentId, name, email, department], index) =>
      prisma.member.create({
        data: {
          memberCode,
          studentId,
          name,
          email,
          department,
          phone: `+233-20-555-${String(1000 + index)}`,
          createdAt: daysAgo(index * 12 + 2),
        },
      }),
    ),
  );

  const borrowSeeds = [
    { book: 8, member: 0, borrowDaysAgo: 1, loanDays: 14, status: 'BORROWED', finePaid: false },
    { book: 9, member: 1, borrowDaysAgo: 1, loanDays: 14, status: 'BORROWED', finePaid: false },
    { book: 2, member: 2, borrowDaysAgo: 2, loanDays: 14, status: 'BORROWED', finePaid: false },
    { book: 4, member: 0, borrowDaysAgo: 45, loanDays: 14, status: 'OVERDUE', finePaid: false },
    { book: 5, member: 1, borrowDaysAgo: 38, loanDays: 14, status: 'OVERDUE', finePaid: false },
    { book: 6, member: 2, borrowDaysAgo: 31, loanDays: 14, status: 'OVERDUE', finePaid: false },
    { book: 7, member: 3, borrowDaysAgo: 29, loanDays: 14, status: 'OVERDUE', finePaid: false },
    { book: 0, member: 4, borrowDaysAgo: 20, loanDays: 14, status: 'RETURNED', returnDaysAgo: 6, finePaid: true },
    { book: 1, member: 5, borrowDaysAgo: 18, loanDays: 14, status: 'RETURNED', returnDaysAgo: 4, finePaid: true },
    { book: 3, member: 6, borrowDaysAgo: 12, loanDays: 14, status: 'RETURNED', returnDaysAgo: 2, finePaid: true },
  ];

  const borrowRecords = await Promise.all(
    borrowSeeds.map((record) => {
      const borrowDate = daysAgo(record.borrowDaysAgo);
      const dueDate = daysAgo(record.borrowDaysAgo - record.loanDays);
      const returnDate = record.returnDaysAgo ? daysAgo(record.returnDaysAgo) : null;
      const fineAmount = record.status === 'OVERDUE' ? calculateFine(dueDate) : calculateFine(dueDate, returnDate ?? new Date());

      return prisma.borrowRecord.create({
        data: {
          bookId: books[record.book].id,
          memberId: members[record.member].id,
          borrowDate,
          dueDate,
          returnDate,
          status: record.status,
          fineAmount,
          finePaid: record.finePaid,
          createdAt: borrowDate,
        },
      });
    }),
  );

  await Promise.all(
    [
      { book: 0, member: 7, status: 'PENDING', queuePosition: 1, daysAgo: 1 },
      { book: 0, member: 8, status: 'PENDING', queuePosition: 2, daysAgo: 2 },
      { book: 1, member: 9, status: 'READY_FOR_PICKUP', queuePosition: 1, daysAgo: 3 },
      { book: 2, member: 4, status: 'PENDING', queuePosition: 1, daysAgo: 4 },
      { book: 3, member: 5, status: 'FULFILLED', queuePosition: 1, daysAgo: 5 },
      { book: 4, member: 6, status: 'PENDING', queuePosition: 1, daysAgo: 6 },
      { book: 5, member: 7, status: 'CANCELLED', queuePosition: 1, daysAgo: 7 },
      { book: 6, member: 8, status: 'PENDING', queuePosition: 1, daysAgo: 8 },
      { book: 7, member: 9, status: 'READY_FOR_PICKUP', queuePosition: 1, daysAgo: 9 },
      { book: 8, member: 3, status: 'PENDING', queuePosition: 1, daysAgo: 10 },
    ].map((reservation) =>
      prisma.reservation.create({
        data: {
          bookId: books[reservation.book].id,
          memberId: members[reservation.member].id,
          status: reservation.status,
          queuePosition: reservation.queuePosition,
          reservedAt: daysAgo(reservation.daysAgo),
        },
      }),
    ),
  );

  await Promise.all(
    [3, 11, 20, 32, 47, 65, 89, 112, 138, 171].map((days) =>
      prisma.visitorLog.create({
        data: {
          visitedAt: daysAgo(days),
        },
      }),
    ),
  );

  console.log(`Seeded dashboard data: ${books.length} books, ${members.length} members, ${borrowRecords.length} borrow records, 10 reservations, 10 visitor logs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });