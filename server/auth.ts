import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import db from './db.ts';

const IN_MEMORY_JWT_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : IN_MEMORY_JWT_SECRET;
}

export type RoleName = 'ADMIN' | 'REGISTRATION_STAFF' | 'DOCTOR' | 'PHARMACIST';

export interface AuthUserPayload {
  id: number;
  staffCode: string;
  fullName: string;
  email: string;
  role: RoleName;
  departmentId: number | null;
  jti: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export function signAuthToken(user: Omit<AuthUserPayload, 'jti'>): { token: string; jti: string; expiresInSeconds: number } {
  const jti = crypto.randomUUID();
  const expiresInSeconds = 60 * 60 * 12; // 12 hours
  const token = jwt.sign(
    {
      ...user,
      jti,
    },
    getJwtSecret(),
    { expiresIn: expiresInSeconds }
  );
  return { token, jti, expiresInSeconds };
}

export function revokeToken(jti: string, expUnix?: number): void {
  const expiresAt = expUnix ?? Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  db.prepare('INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(jti, expiresAt);
  // Cleanup expired revocations opportunistically
  db.prepare('DELETE FROM revoked_tokens WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
}

export function verifyBearerUser(authHeader?: string): AuthUserPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUserPayload & { exp?: number };
    const revoked = db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(decoded.jti);
    if (revoked) {
      return null;
    }

    const dbUser = db
      .prepare(`
        SELECT u.id, u.staff_code, u.full_name, u.email, u.status, u.department_id, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `)
      .get(decoded.id) as {
        id: number;
        staff_code: string;
        full_name: string;
        email: string;
        status: string;
        department_id: number | null;
        role_name: RoleName;
      } | undefined;

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      return null;
    }

    return {
      id: dbUser.id,
      staffCode: dbUser.staff_code,
      fullName: dbUser.full_name,
      email: dbUser.email,
      role: dbUser.role_name,
      departmentId: dbUser.department_id,
      jti: decoded.jti,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const verifiedUser = verifyBearerUser(req.headers.authorization);
  if (!verifiedUser) {
    res.status(401).json({ success: false, message: 'Authentication required. Please sign in with a valid token.' });
    return;
  }
  req.user = verifiedUser;
  next();
}

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}

export function getPermissionsForRole(roleName: string): string[] {
  const rows = db
    .prepare(`
      SELECT p.code
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ?
      ORDER BY p.id
    `)
    .all(roleName) as Array<{ code: string }>;
  return rows.map((r) => r.code);
}
