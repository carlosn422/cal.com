import process from "node:process";
import type { NextApiRequest, NextApiResponse } from "next";
import provisionUser from "../../../lib/provisioning.service";

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

  try {
    const { user, eventType, apiKey, apiKeyCreated } = await provisionUser(normalizedEmail);

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
        token: apiKeyCreated ? apiKey.token : "",
      },
    });
  } catch (error) {
    console.error("Provisioning error:", error);
    // A generic error to avoid leaking implementation details
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
