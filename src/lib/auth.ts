import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getDatabase } from './database';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          const db = getDatabase();

          // Check if user exists, if not create
          const existingUser = db.prepare(`
            SELECT * FROM users WHERE email = ?
          `).get(user.email);

          if (!existingUser) {
            db.prepare(`
              INSERT INTO users (id, email, name, image, created_at, updated_at)
              VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(user.id, user.email, user.name, user.image);
          } else {
            // Update user info if changed
            db.prepare(`
              UPDATE users SET name = ?, image = ?, updated_at = datetime('now')
              WHERE email = ?
            `).run(user.name, user.image, user.email);
          }
        } catch (error) {
          console.error('Error saving user to database:', error);
          // Don't block sign in on database error
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email || '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
  }
}
