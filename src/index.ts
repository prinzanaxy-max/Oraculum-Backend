import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import booksRoutes from './routes/books.routes';
import membersRoutes from './routes/members.routes';
import borrowRoutes from './routes/borrow.routes';
import reservationsRoutes from './routes/reservations.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Admin email configured as: ${process.env.ADMIN_EMAIL}`);
});