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

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL || '').split(','),
]
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
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