import { Prisma } from "./generated/prisma/client";
import { prisma } from "./index";

export async function isPrismaAvailableCheck(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$disconnect();
    return true;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return false;
    }
    throw e;
  }
}
