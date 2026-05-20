const { z } = require('zod');

const RegisterSchema = z.object({
  phone: z.string().min(6).max(20),
  fullName: z.string().min(1).max(120),
  email: z.string().email().optional(),
  password: z.string().min(6).max(72),
  role: z.enum(['passenger', 'driver', 'admin']).optional(),
});

const LoginSchema = z.object({
  phone: z.string().min(6).max(20),
  password: z.string().min(6).max(72),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(72),
  newPassword: z.string().min(6).max(72),
});

module.exports = { RegisterSchema, LoginSchema, ChangePasswordSchema };
