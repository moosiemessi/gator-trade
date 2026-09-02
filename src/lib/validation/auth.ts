import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const signupSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  uflEmail: email.refine((value) => value.endsWith("@ufl.edu"), {
    message: "Must be a ufl.edu address",
  }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
