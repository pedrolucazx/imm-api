import { eq } from "drizzle-orm";
import { getDb } from "../../core/database/connection.js";
import {
  userProfiles,
  type NewUserProfile,
  type UserProfile,
} from "../../core/database/schema/index.js";

type MutableUserProfileFields = Omit<NewUserProfile, "id" | "userId">;

export class UserProfilesRepository {
  async create(data: NewUserProfile): Promise<UserProfile> {
    const [profile] = await getDb().insert(userProfiles).values(data).returning();
    return profile;
  }

  async findByUserId(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await getDb()
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  }

  async update(
    userId: string,
    data: Partial<MutableUserProfileFields>
  ): Promise<UserProfile | undefined> {
    const [profile] = await getDb()
      .update(userProfiles)
      .set(data)
      .where(eq(userProfiles.userId, userId))
      .returning();
    return profile;
  }
}

export const userProfilesRepository = new UserProfilesRepository();
