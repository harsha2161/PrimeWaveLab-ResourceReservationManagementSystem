import { NextResponse } from "next/server";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";

export const POST = withErrorHandler(async () => {
  const response = successResponse(null, "Logged out successfully");

  // Clear authentication cookie
  response.cookies.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
});
