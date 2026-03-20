// Route API for Registration - handles POST requests to create new user accounts.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password } = body;

  // 1. Validate all fields are present
  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  // 2. Sanitize and validate name
  const trimmedName = String(name).trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    return NextResponse.json({ error: "Name must be between 1 and 100 characters." }, { status: 400 });
  }

  // 3. Validate email format and length (RFC 5321 max 254)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== "string" || !emailRegex.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  // 4. Validate password length (min 8, max 128 to prevent bcrypt DoS)
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be between 8 and 128 characters." }, { status: 400 });
  }

  // 5. Check if a user with this email already exists
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  // 6. Hash the password — 12 salt rounds
  const hashedPassword = await bcrypt.hash(password, 12);

  // 7. Save the new user to the database (store email in lowercase for consistency)
  await prisma.user.create({
    data: { name: trimmedName, email: email.toLowerCase(), password: hashedPassword },
  });

  return NextResponse.json({ message: "Account created." }, { status: 201 });
}
