import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function verifyGoogleToken(idToken: string): Promise<VerifiedGoogleUser> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.email || !payload.sub) {
    throw new Error('Invalid Google token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    emailVerified: payload.email_verified === true,
  };
}
