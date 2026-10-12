-- CreateTable
CREATE TABLE "users" (
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("email")
);
