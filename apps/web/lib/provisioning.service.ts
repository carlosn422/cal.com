
import { randomBytes } from "crypto";
import { hashPassword } from "@calcom/lib/auth/hashPassword";
import { slugify } from "@calcom/lib/slugify";
import { PrismaApiKeyRepository } from "@calcom/features/ee/api-keys/repositories/PrismaApiKeyRepository";
import prisma from "@calcom/prisma";

async function provisionUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let user, apiKey, eventType;
  let apiKeyCreated = false;

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    user = existingUser;
  } else {
    const randomPassword = randomBytes(16).toString("hex");
    const hashedPassword = await hashPassword(randomPassword);
    const username = slugify(normalizedEmail.split('@')[0] || `user-${Date.now()}`);

    user = await prisma.user.create({
      data: {
        username,
        name: username,
        email: normalizedEmail,
        password: { create: { hash: hashedPassword } },
        emailVerified: new Date(),
        completedOnboarding: true,
        role: "USER",
      },
    });
  }

  const eventTypeTitle = "Ai Assistant";
  const existingEventType = await prisma.eventType.findFirst({
    where: { userId: user.id, title: eventTypeTitle },
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

  const apiKeyName = "Platform Managed Key";
  const existingApiKey = await prisma.apiKey.findFirst({
    where: { userId: user.id, note: apiKeyName },
  });

  if (existingApiKey) {
    apiKey = { name: apiKeyName, token: "" };
  } else {
    const apiKeyRepository = await PrismaApiKeyRepository.withGlobalPrisma();
    const newApiKeyToken = await apiKeyRepository.createApiKey({
      userId: user.id,
      note: apiKeyName,
      expiresAt: null,
    });
    apiKey = { name: apiKeyName, token: newApiKeyToken };
    apiKeyCreated = true;
  }

  return {
    user,
    eventType,
    apiKey,
    apiKeyCreated,
  };
}

export default provisionUser;

