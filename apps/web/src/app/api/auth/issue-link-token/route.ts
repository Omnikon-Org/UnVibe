import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Create a signed token using a simple HMAC with NEXTAUTH_SECRET
  const secret = process.env.NEXTAUTH_SECRET || "";
  const payload = JSON.stringify({
    sub: session.user.id,
    email: session.user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60, // 1 minute expiry
  });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(payload).toString("base64") + "." + signature;
  return NextResponse.json({ token });
}
