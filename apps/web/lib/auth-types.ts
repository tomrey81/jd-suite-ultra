import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    orgId?: string;
    orgRole?: 'ADMIN' | 'OWNER' | 'MEMBER';
  }

  interface JWT {
    id: string;
    orgId?: string;
    orgRole?: string;
  }
}
