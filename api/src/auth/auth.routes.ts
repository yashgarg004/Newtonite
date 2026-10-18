import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app-error';
import { env } from '../config/env';
import { loginSchema } from './auth.schemas';

const router = Router();

router.post('/login', async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.users.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      email: true,
      name: true,
      password_hash: true,
      memberships: {
        select: {
          team_id: true,
          role: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await argon2.verify(user.password_hash, body.password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      teams: user.memberships.map((m) => ({
        id: m.team_id,
        name: m.team.name,
        role: m.role,
      })),
    },
  });
});

export { router as authRoutes };