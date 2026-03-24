import { eq } from "drizzle-orm";
import { getDb } from "@/core/database/connection.js";
import { users } from "@/core/database/schema/users.schema.js";

export async function verifyEmailInDb(email: string): Promise<void> {
  await getDb().update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email));
}
