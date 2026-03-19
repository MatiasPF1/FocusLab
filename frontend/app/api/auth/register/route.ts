import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  // 1.  validation — make sure all fields were sent
  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  // 2. Check if a user with this email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  // 3. Hash the password, The "12" is the salt rounds 
  const hashedPassword = await bcrypt.hash(password, 12);

  // 4. Save the new user to the database
  await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  return NextResponse.json({ message: "Account created." }, { status: 201 });
}
