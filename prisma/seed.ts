import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const createManyInChunks = async <T>(items: T[], createMany: (data: T[]) => Promise<unknown>, size = 500) => {
  for (const group of chunk(items, size)) {
    await createMany(group);
  }
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

  await prisma.refreshToken.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.borrowRecord.deleteMany();
  await prisma.visitorLog.deleteMany();
  await prisma.member.deleteMany();
  await prisma.book.deleteMany();

  const bookCopies = [900, 700, 500, 400, 300, 200, 100, 50, 30, 25, 6000, 5000, 4000, 3500, 3000, 2500, 2000, 1500, 1000, 400, 200, 40];
  const bookSeeds = [
    ['The Midnight Library', 'Matt Haig', '978-0525559474', 'Fiction', 2020],
    ['Atomic Habits', 'James Clear', '978-0735211292', 'Self Development', 2018],
    ['Dune', 'Frank Herbert', '978-0441172719', 'Science Fiction', 1965],
    ['Project Hail Mary', 'Andy Weir', '978-0593135204', 'Science Fiction', 2021],
    ['The Great Gatsby', 'F. Scott Fitzgerald', '978-0743273565', 'Classic', 1925],
    ['1984', 'George Orwell', '978-0451524935', 'Classic', 1949],
    ['To Kill a Mockingbird', 'Harper Lee', '978-0060935467', 'Classic', 1960],
    ['Pride and Prejudice', 'Jane Austen', '978-0061120084', 'Classic', 1813],
    ['The Catcher in the Rye', 'J.D. Salinger', '978-0316769488', 'Classic', 1951],
    ['Frankenstein', 'Mary Shelley', '978-0141439471', 'Gothic Fiction', 1818],
    ['Moby Dick', 'Herman Melville', '978-0553213119', 'Classic', 1851],
    ['Things Fall Apart', 'Chinua Achebe', '978-0385474542', 'African Literature', 1958],
    ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie', '978-1400095209', 'Historical Fiction', 2006],
    ['Homegoing', 'Yaa Gyasi', '978-1101971062', 'Historical Fiction', 2016],
    ['The Hobbit', 'J.R.R. Tolkien', '978-0618260300', 'Fantasy', 1937],
    ['Educated', 'Tara Westover', '978-0399590504', 'Memoir', 2018],
    ['Sapiens', 'Yuval Noah Harari', '978-0062316097', 'History', 2014],
    ['The Alchemist', 'Paulo Coelho', '978-0061122415', 'Fiction', 1988],
    ['Purple Hibiscus', 'Chimamanda Ngozi Adichie', '978-1616202415', 'African Literature', 2003],
    ['Born a Crime', 'Trevor Noah', '978-0399588174', 'Memoir', 2016],
    ['The Kite Runner', 'Khaled Hosseini', '978-1594631931', 'Fiction', 2003],
    ['A Brief History of Time', 'Stephen Hawking', '978-0553380163', 'Science', 1988],
  ];

  const books = await Promise.all(
    bookSeeds.map(([title, author, isbn, category, publishedYear], index) =>
      prisma.book.create({
        data: {
          title: String(title),
          author: String(author),
          isbn: String(isbn),
          category: String(category),
          publishedYear: Number(publishedYear),
          totalCopies: bookCopies[index],
          description: `${title} by ${author}.`,
          status: index >= 9 && index <= 20 ? 'MISSING' : 'AVAILABLE',
          createdAt: index >= 10 ? daysAgo(210 + index) : daysAgo(index + 1),
        },
      }),
    ),
  );

  const seededMemberNames = [
    'Sarah Jenkins',
    'David Chen',
    'Emily Rodriguez',
    'Michael Chang',
    'Ama Mensah',
    'Kwame Boateng',
    'Nadia Owusu',
    'Ethan Brooks',
    'Aisha Bello',
    'Noah Williams',
    'Abena Osei',
    'Daniel Mensah',
    'Ivy Nkrumah',
    'Kofi Addo',
    'Maya Johnson',
    'Liam Carter',
    'Sofia Martinez',
    'James Wilson',
    'Fatima Ali',
    'Grace Thompson',
    'Samuel Okafor',
    'Priya Shah',
    'Lucas Brown',
    'Hannah Davis',
    'Benjamin Taylor',
    'Chloe Anderson',
    'Victor Adams',
    'Zara Khan',
    'Nathan Green',
    'Olivia Scott',
    'Elijah Walker',
    'Mina Park',
    'Caleb Moore',
    'Leah White',
    'Aaron Young',
    'Ella King',
    'Jason Wright',
    'Nora Hill',
    'Omar Hassan',
    'Ruby Lewis',
    'Isaac Hall',
    'Lydia Clark',
    'Peter Allen',
    'Mariam Diallo',
    'Henry Baker',
    'Rose Nelson',
    'Ivan Cooper',
    'Tessa Morgan',
    'Simon Reed',
    'Eva Bell',
    'George Murphy',
    'Naomi Rivera',
    'Paul Cook',
    'Lara Bailey',
    'Derek Gray',
    'Anita Foster',
    'Brian Hughes',
    'Clara Ward',
    'Felix Ross',
    'Ruth Price',
    'Adam Bennett',
    'Irene Wood',
    'Mark Barnes',
    'Sally Brooks',
    'Theo Kelly',
    'Diana Sanders',
    'Joel Peterson',
    'Mabel Coleman',
    'Eric Jenkins',
    'Tina Powell',
    'Carl Long',
    'June Patterson',
  ];

  const members = await Promise.all(
    seededMemberNames.map((name, index) =>
      prisma.member.create({
        data: {
          memberCode: `M-${String(1024 + index).padStart(4, '0')}`,
          studentId: `STF-${String(1024 + index).padStart(4, '0')}`,
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@oraculum.edu.gh`,
          department: ['Library Science', 'Computer Science', 'English', 'History', 'Business', 'Engineering'][index % 6],
          phone: `+233-20-555-${String(1000 + index)}`,
          createdAt: index < 34 ? daysAgo((index % 28) + 1) : daysAgo(190 + index),
        },
      }),
    ),
  );

  const borrowRecords: {
    bookId: string;
    memberId: string;
    borrowDate: Date;
    dueDate: Date;
    returnDate?: Date | null;
    status: string;
    fineAmount: number;
    finePaid: boolean;
    createdAt: Date;
  }[] = [];

  const pushBorrowRecords = (count: number, status: string, startOffset: number, options: { returned?: boolean; previous?: boolean; fineAmount?: number }) => {
    for (let index = 0; index < count; index += 1) {
      const borrowDate = daysAgo(startOffset + (index % 160));
      const dueDate = addDays(borrowDate, 14);
      const returnDate = options.returned ? addDays(borrowDate, 10 + (index % 5)) : null;

      borrowRecords.push({
        bookId: books[index % books.length].id,
        memberId: members[index % members.length].id,
        borrowDate,
        dueDate: status === 'OVERDUE' ? daysAgo(options.previous ? startOffset + (index % 160) : 15 + (index % 25)) : dueDate,
        returnDate,
        status,
        fineAmount: options.fineAmount ?? 0,
        finePaid: status === 'RETURNED',
        createdAt: borrowDate,
      });
    }
  };

  pushBorrowRecords(1577, 'BORROWED', 1, {});
  pushBorrowRecords(783, 'RETURNED', 20, { returned: true });
  pushBorrowRecords(45, 'OVERDUE', 5, { fineAmount: 17 });
  pushBorrowRecords(1005, 'BORROWED', 190, { previous: true });
  pushBorrowRecords(910, 'RETURNED', 205, { returned: true, previous: true });
  pushBorrowRecords(40, 'OVERDUE', 192, { fineAmount: 12.25, previous: true });

  await createManyInChunks(borrowRecords, (data) => prisma.borrowRecord.createMany({ data }), 500);

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

  const visitorLogs = [
    ...Array.from({ length: 1504 }, (_, index) => ({ visitedAt: daysAgo((index % 175) + 1) })),
    ...Array.from({ length: 1460 }, (_, index) => ({ visitedAt: daysAgo(190 + (index % 175)) })),
  ];

  await createManyInChunks(
    visitorLogs,
    (data) =>
      prisma.visitorLog.createMany({
        data,
      }),
    500,
  );

  console.log(`Seeded dashboard data: ${books.length} books, ${members.length} members, ${borrowRecords.length} borrow records, 10 reservations, ${visitorLogs.length} visitor logs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });