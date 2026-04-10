import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";
import { encode } from "next-auth/jwt";
import { serialize } from "cookie";
import provisionUser from "../../lib/provisioning.service";
import prisma from "@calcom/prisma";

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("Firebase credentials not set");
}

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;

  if (typeof token !== "string") {
    return res.status(400).json({ error: "Token must be a string." });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email) {
      return res.status(400).json({ error: "Email not found in token." });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const provisionedData = await provisionUser(email);
      user = provisionedData.user;
    }

    const nextAuthToken = {
      name: user.name,
      email: user.email,
      picture: user.avatarUrl,
      sub: user.id.toString(),
      id: user.id,
      username: user.username,
      role: user.role,
      locale: user.locale || ("en" as string),
    };

    const sessionToken = await encode({
      secret: process.env.NEXTAUTH_SECRET as string,
      token: nextAuthToken,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const cookie = serialize("next-auth.session-token", sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.setHeader("Set-Cookie", cookie);
    res.redirect(307, "/event-types");
  } catch (error) {
    console.error("Deep link auth error:", error);
    res.status(401).json({ error: "Invalid token." });
  }
}
