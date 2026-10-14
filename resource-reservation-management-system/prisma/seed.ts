import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

// 1. Users Data (Admin + Regular Users)
const userData: Prisma.UsersCreateInput[] = [
  {
    email: "admin@gmail.com",
    phone: "+94771111111",
    firstName: "Super",
    lastName: "Admin",
    password: "$2a$12$KR5t/kTbHTeBmeis8m49ruXRE4HC0vfCCWWwMS4SsF.U5iNdM5ny2", // admin
    role: "ADMIN",
    status: "ACTIVE",
  },
  {
    email: "user@primewavelab.com",
    phone: "+94772222222",
    firstName: "John",
    lastName: "Doe",
    password: "$2a$12$KR5t/kTbHTeBmeis8m49ruXRE4HC0vfCCWWwMS4SsF.U5iNdM5ny2", // admin
    role: "USER",
    status: "ACTIVE",
  },
];

// 2. 5 Sample Categories
const categoryData: Prisma.ResourceCategoryCreateInput[] = [
  {
    id: "cat-conf-01",
    name: "Conference Rooms",
    description: "Modern meeting rooms, boardrooms, and executive presentation spaces.",
  },
  {
    id: "cat-lab-02",
    name: "Laboratories & Research",
    description: "Specialized high-performance computing, ML clusters, and engineering test facilities.",
  },
  {
    id: "cat-equip-03",
    name: "AV & Media Equipment",
    description: "Professional 4K cameras, stage audio systems, field monitors, and production gear.",
  },
  {
    id: "cat-veh-04",
    name: "Transport & Vehicles",
    description: "Executive electric cars, fleet SUVs, and corporate shuttle vehicles.",
  },
  {
    id: "cat-studio-05",
    name: "Creative Studios",
    description: "Soundproofed podcast, voiceover, and multimedia recording studios.",
  },
];

// 3. 5 Sample Resources
const resourceData: Prisma.ResourceCreateInput[] = [
  {
    id: "res-001",
    name: "Executive Boardroom Alpha",
    code: "RES001",
    description:
      "Ultra-modern executive boardroom with 4K telepresence display, smart microphones, and seating for 20 executives.",
    location: "Floor 10, Tower A",
    maxCapacity: 20,
    status: "ACTIVE",
    resourceCategory: { connect: { id: "cat-conf-01" } },
  },
  {
    id: "res-002",
    name: "AI & Quantum Computing Lab",
    code: "RES002",
    description:
      "High-performance GPU cluster lab with 8x NVIDIA RTX A6000 nodes for deep learning and neural network training.",
    location: "Floor 7, Tech Wing",
    maxCapacity: 15,
    status: "ACTIVE",
    resourceCategory: { connect: { id: "cat-lab-02" } },
  },
  {
    id: "res-003",
    name: "Sony FX6 Cinema 4K Camera Rig",
    code: "RES003",
    description:
      "Full-frame cinema production kit with prime lenses, wireless audio receivers, carbon fiber tripod, and field monitor.",
    location: "Media Bay, Floor 2",
    maxCapacity: 1,
    status: "ACTIVE",
    resourceCategory: { connect: { id: "cat-equip-03" } },
  },
  {
    id: "res-004",
    name: "Tesla Model Y Executive Fleet",
    code: "RES004",
    description:
      "All-wheel drive premium electric SUV with Autopilot, VIP chauffeur kit, and supercharging card for business travel.",
    location: "VIP Parking Bay 01",
    maxCapacity: 5,
    status: "ACTIVE",
    resourceCategory: { connect: { id: "cat-veh-04" } },
  },
  {
    id: "res-005",
    name: "Acoustic Podcast & Studio Suite",
    code: "RES005",
    description:
      "Sound-isolated recording room with Shure SM7B broadcast microphones, Rodecaster Pro II mixer, and 4K cameras.",
    location: "Floor 3, Creative Block",
    maxCapacity: 6,
    status: "ACTIVE",
    resourceCategory: { connect: { id: "cat-studio-05" } },
  },
];

export async function main() {
  console.log("🌱 Starting seed process...");

  // Seed Users
  console.log("👥 Seeding users...");
  for (const u of userData) {
    await prisma.users.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        role: u.role,
        status: u.status,
      },
      create: u,
    });
  }
  console.log(`✅ Seeded ${userData.length} users.`);

  // Seed Categories
  console.log("📦 Seeding categories...");
  for (const cat of categoryData) {
    await prisma.resourceCategory.upsert({
      where: { id: cat.id as string },
      update: {
        name: cat.name,
        description: cat.description,
      },
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categoryData.length} categories.`);

  // Seed 5 Sample Resources
  console.log("🏢 Seeding 5 sample resources...");
  for (const res of resourceData) {
    await prisma.resource.upsert({
      where: { id: res.id as string },
      update: {
        name: res.name,
        code: res.code,
        description: res.description,
        location: res.location,
        maxCapacity: res.maxCapacity,
        status: res.status,
      },
      create: res,
    });
  }
  console.log(`✅ Seeded ${resourceData.length} sample resources.`);

  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });