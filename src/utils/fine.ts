export const calculateFine = (dueDate: Date, returnDate: Date = new Date()): number => {
  const FINE_PER_DAY = Number(process.env.FINE_PER_DAY) || 1;

  if (returnDate <= dueDate) {
    return 0;
  }

  const diffTime = Math.abs(returnDate.getTime() - dueDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays * FINE_PER_DAY;
};