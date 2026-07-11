import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';

export const signToken = (payload: object, expiresIn: string = '12h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};