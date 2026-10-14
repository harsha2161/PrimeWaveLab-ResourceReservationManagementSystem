import { SignJWT, jwtVerify } from "jose";

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  status: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production-at-least-32-chars";
const encodedKey = new TextEncoder().encode(JWT_SECRET);

//Sign a new JWT token with user credentials
export async function signAuthToken(
  payload: AuthTokenPayload,
  expiresIn: string = "7d"
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedKey);
}
 //Verify and decode an existing JWT token
export async function verifyAuthToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });

    return {
      userId: payload.userId as string || (payload.sub as string),
      email: payload.email as string,
      role: payload.role as string,
      status: payload.status as string,
    };
  } catch (error) {
    return null;
  }
}
