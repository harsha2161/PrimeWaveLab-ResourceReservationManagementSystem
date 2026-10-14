import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/security/validations/auth";
import { hashPassword, comparePassword } from "@/lib/security/auth-service";
import { signAuthToken, verifyAuthToken } from "@/lib/security/jwt";

describe("Authentication Unit Tests", () => {
  describe("1. User Registration Input Validation (Zod)", () => {
    it("TC-AUTH-001: should pass validation with complete and valid registration data", () => {
      const result = registerSchema.safeParse({
        firstName: "Kasun",
        lastName: "Perera",
        email: "kasun.perera@example.com",
        phone: "+94771234567",
        password: "Password@123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("kasun.perera@example.com");
        expect(result.data.firstName).toBe("Kasun");
      }
    });

    it("TC-AUTH-002: should fail validation when required fields are missing or empty", () => {
      const result = registerSchema.safeParse({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it("TC-AUTH-003: should reject malformed email addresses", () => {
      const result = registerSchema.safeParse({
        firstName: "Kasun",
        lastName: "Perera",
        email: "not-an-email-format",
        phone: "+94771234567",
        password: "Password@123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const emailIssue = result.error.issues.find((i) => i.path.includes("email"));
        expect(emailIssue).toBeDefined();
        expect(emailIssue?.message).toContain("Invalid email format");
      }
    });

    it("TC-AUTH-004: should reject passwords shorter than 8 characters", () => {
      const result = registerSchema.safeParse({
        firstName: "Kasun",
        lastName: "Perera",
        email: "test@example.com",
        phone: "+94771234567",
        password: "Pass1!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const passIssue = result.error.issues.find((i) => i.path.includes("password"));
        expect(passIssue?.message).toContain("at least 8 characters");
      }
    });

    it("TC-AUTH-005: should reject passwords missing a special character", () => {
      const result = registerSchema.safeParse({
        firstName: "Kasun",
        lastName: "Perera",
        email: "test@example.com",
        phone: "+94771234567",
        password: "Password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const passIssue = result.error.issues.find((i) => i.path.includes("password"));
        expect(passIssue?.message).toContain("special character");
      }
    });

    it("TC-AUTH-006: should reject passwords missing an uppercase letter", () => {
      const result = registerSchema.safeParse({
        firstName: "Kasun",
        lastName: "Perera",
        email: "test@example.com",
        phone: "+94771234567",
        password: "password@123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const passIssue = result.error.issues.find((i) => i.path.includes("password"));
        expect(passIssue?.message).toContain("uppercase letter");
      }
    });

    it("TC-AUTH-007: should reject invalid phone numbers", () => {
      const result = registerSchema.safeParse({
        firstName: "Kasun",
        lastName: "Perera",
        email: "test@example.com",
        phone: "phone-1234",
        password: "Password@123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const phoneIssue = result.error.issues.find((i) => i.path.includes("phone"));
        expect(phoneIssue?.message).toContain("Invalid phone number format");
      }
    });
  });

  describe("2. User Login Input Validation (Zod)", () => {
    it("TC-AUTH-008: should pass validation with valid email and password", () => {
      const result = loginSchema.safeParse({
        email: "kasun.perera@example.com",
        password: "Password@123",
      });

      expect(result.success).toBe(true);
    });

    it("TC-AUTH-009: should reject login payload with missing email", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "Password@123",
      });

      expect(result.success).toBe(false);
    });

    it("TC-AUTH-010: should reject login payload with empty password", () => {
      const result = loginSchema.safeParse({
        email: "kasun@example.com",
        password: "",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("3. Bcrypt Password Hashing & Security", () => {
    const plainPassword = "SecretPassword@2026";
    let hashedPassword = "";

    it("TC-AUTH-011: should hash password securely so it does not match plaintext", async () => {
      hashedPassword = await hashPassword(plainPassword);
      expect(hashedPassword).not.toBe(plainPassword);
      expect(typeof hashedPassword).toBe("string");
      expect(hashedPassword.length).toBeGreaterThan(20);
    });

    it("TC-AUTH-012: should generate standard bcrypt hash identifier ($2a / $2b)", () => {
      expect(hashedPassword.startsWith("$2a$") || hashedPassword.startsWith("$2b$")).toBe(true);
    });

    it("TC-AUTH-013: should return true when comparing correct plaintext password with hash", async () => {
      const isMatch = await comparePassword(plainPassword, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it("TC-AUTH-014: should return false when comparing incorrect password with hash", async () => {
      const isWrongMatch = await comparePassword("WrongPassword@999", hashedPassword);
      expect(isWrongMatch).toBe(false);
    });
  });

  describe("4. JOSE JWT Token Security", () => {
    const payload = {
      userId: "usr-uuid-test-1234",
      email: "engineer@primewave.com",
      role: "ADMIN",
      status: "ACTIVE",
    };
    let token = "";

    it("TC-AUTH-015: should issue a valid 3-part header.payload.signature JWT token", async () => {
      token = await signAuthToken(payload, "2h");
      expect(typeof token).toBe("string");
      const parts = token.split(".");
      expect(parts.length).toBe(3);
    });

    it("TC-AUTH-016: should verify and correctly decode user claims from valid token", async () => {
      const decoded = await verifyAuthToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
      expect(decoded?.role).toBe(payload.role);
      expect(decoded?.status).toBe(payload.status);
    });

    it("TC-AUTH-017: should reject tampered token signatures", async () => {
      const tamperedToken = token.substring(0, token.length - 8) + "hacked12";
      const decoded = await verifyAuthToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it("TC-AUTH-018: should reject expired tokens", async () => {
      // Create a token that expires instantly in 0s
      const expiredToken = await signAuthToken(payload, "-1s");
      const decoded = await verifyAuthToken(expiredToken);
      expect(decoded).toBeNull();
    });
  });
});
