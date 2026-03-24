import { eq } from "drizzle-orm";
import { getDb } from "@/core/database/connection.js";
import { users } from "@/core/database/schema/users.schema.js";

export async function verifyEmailInDb(email: string): Promise<void> {
  const updated = await getDb()
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ id: users.id });

  if (updated.length !== 1) {
    throw new Error(
      `verifyEmailInDb expected to update 1 user for ${email}, but updated ${updated.length}`
    );
  }
}
