import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const userData: Prisma.UserCreateInput[] = [
  {
    email: "admin@example.com",
    phone: "+94771111111",
    firstName: "Super",
    lastName: "Admin",
    password: "$2a$12$KR5t/kTbHTeBmeis8m49ruXRE4HC0vfCCWWwMS4SsF.U5iNdM5ny2", // admin 
    role: "ADMIN",
    status: "ACTIVE",
    privileges: []
  },
];

export async function main() {
  for (const u of userData) {
    await prisma.user.create({ data: u });
  }
}

main();