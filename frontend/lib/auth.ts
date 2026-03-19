import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";



export const { handlers, signIn, signOut, auth } = NextAuth({adapter: PrismaAdapter(prisma),
//gets handlers,signIn, signOut, and auth functions from NextAuth to export for use in the app
//adapter: PrismaAdapter(prisma) connects NextAuth to  Prisma database, allowing  to store user data and sessions there



  //Use JWT sessions , using the credentials as Email and Passwors
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },


    //Authorize function to validate user credentials
      async authorize(credentials) {
        //                     Case where email or password is missing
        if (!credentials?.email || !credentials?.password) 
            return null;

        //0-Get the user from the database by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        //                     if the user doesnt exist, return null
        if (!user) return null;

        //1-Compare the submitted password against the stored hash
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        //                     if the password is incorrect, return null
        if (!passwordMatch) return null;

        //2-Return the user object
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],


  callbacks: {
    // Put the user id into the token so we can access it server-side
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },

    
    // Expose the id on the session object
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },

});
