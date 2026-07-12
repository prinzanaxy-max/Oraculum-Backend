import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';

export interface TokenPayload {
  id: string;
  email: string;
  jti?: string;
}

export const signAccessToken = (payload: TokenPayload) => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '15m' });
};

export const signRefreshToken = (payload: TokenPayload) => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '7d' });
};

export const signToken = (payload: TokenPayload, expiresIn: string = '15m') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyAccessToken = verifyToken;
export const verifyRefreshToken = verifyToken;