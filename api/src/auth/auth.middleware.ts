import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app-error';
import { env } from '../config/env';
import type { member_role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  memberships: Map<string, member_role>;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid authorization header');
    }

    const token = header.slice(7);
    let payload: { userId: string };

    try {
      payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
    }

    const user = await prisma.users.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'User not found');
    }

    const memberships = await prisma.memberships.findMany({
      where: { user_id: user.id },
      select: { team_id: true, role: true },
    });

    const membershipMap = new Map<string, member_role>();
    for (const m of memberships) {
      membershipMap.set(m.team_id, m.role);
    }

    req.user = { ...user, memberships: membershipMap };
    next();
  } catch (err) {
    next(err);
  }
}