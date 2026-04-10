
import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";

import prisma from "@calcom/prisma";
import { hashPassword } from "@calcom/lib/auth/hashPassword";
import { PrismaApiKeyRepository } from "@calcom/features/ee/api-keys/repositories/PrismaApiKeyRepository";
import { slugify } from "@calcom/lib/slugify";

// --- Authentication
const provisionToken = process.env.INTERNAL_PROVISION_TOKEN;

function authenticate(req: NextApiRequest) {
  const tokenFromHeader = req.headers.authorization?.replace("Bearer ", "");
  const tokenFromInternalHeader = req.headers["x-internal-token"];
  const token = tokenFromHeader || tokenFromInternalHeader;

  if (!provisionToken || token !== provisionToken) {
    return false;
  }
  return true;
}

// --- Email Normalization
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  if (!authenticate(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "Missing or invalid email" });
  }

  const normalizedEmail = normalizeEmail(email);
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
  }

  let user;
  let apiKey;
  let eventType;
  let apiKeyCreated = false;

  try {
    // --- 1. Find or Create User
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      user = existingUser;
    } else {
      // Platform-only auth handoff would happen here.
      // For now, we create a user with a random password.
      const randomPassword = randomBytes(16).toString("hex");
      const hashedPassword = await hashPassword(randomPassword);
      const username = slugify(normalizedEmail.split('@')[0] || `user-${Date.now()}`);

      user = await prisma.user.create({
        data: {
          username,
          name: username,
          email: normalizedEmail,
          password: { create: { hash: hashedPassword } },
          emailVerified: new Date(), // Activate account immediately
          completedOnboarding: true,
          role: "USER",
          // Future: A custom auth method could be specified here
          // identityProvider: "PLATFORM_MANAGED" 
        },
      });
      // Do not send welcome/verification emails.
    }

    // --- 2. Find or Create Event Type
    const eventTypeTitle = "Ai Assistant";
    const existingEventType = await prisma.eventType.findFirst({
        where: {
            userId: user.id,
            title: eventTypeTitle,
        },
    });

    if (existingEventType) {
        eventType = existingEventType;
    } else {
        eventType = await prisma.eventType.create({
            data: {
                title: eventTypeTitle,
                slug: slugify(eventTypeTitle),
                length: 30,
                users: { connect: { id: user.id } },
            },
        });
    }

    // --- 3. Find or Create API Key
    const apiKeyName = "Platform Managed Key";
    const existingApiKey = await prisma.apiKey.findFirst({
        where: {
            userId: user.id,
            note: apiKeyName,
        }
    });

    if (existingApiKey) {
        // We don't return the key if it already exists
        apiKey = { name: apiKeyName, token: "" };
    } else {
        const apiKeyRepository = await PrismaApiKeyRepository.withGlobalPrisma();
        const newApiKeyToken = await apiKeyRepository.createApiKey({
            userId: user.id,
            note: apiKeyName,
            expiresAt: null, // Never expires
        });
        apiKey = { name: apiKeyName, token: newApiKeyToken };
        apiKeyCreated = true;
    }

    // --- 4. Prepare and Return Response
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      eventType: {
        id: eventType.id,
        title: eventType.title,
        slug: eventType.slug,
      },
      apiKey: {
          name: apiKey.name,
          // Only return the token if it was just created
          token: apiKeyCreated ? apiKey.token : ""
      }
    });

  } catch (error) {
    console.error("Provisioning error:", error);
    // A generic error to avoid leaking implementation details
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
