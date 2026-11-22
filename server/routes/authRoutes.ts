import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.ts';
import {
  AuthenticatedRequest,
  getPermissionsForRole,
  requireAuth,
  revokeToken,
  RoleName,
  signAuthToken,
  verifyBearerUser,
} from '../auth.ts';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    res.status(400).json({ success: false, message: 'Email and password are required.' });
    return;
  }

  const user = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.email, u.password_hash, u.phone,
             u.specialization, u.qualification, u.consultation_fee, u.department_id,
             u.status, r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.email) = LOWER(?)
    `)
    .get(email.trim()) as {
      id: number;
      staff_code: string;
      full_name: string;
      email: string;
      password_hash: string;
      phone: string | null;
      specialization: string | null;
      qualification: string | null;
      consultation_fee: number;
      department_id: number | null;
      status: string;
      role_name: RoleName;
      department_name: string | null;
    } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ success: false, message: 'Invalid email or password.' });
    return;
  }

  if (user.status !== 'ACTIVE') {
    res.status(403).json({ success: false, message: 'Your staff account is currently inactive. Contact Administrator.' });
    return;
  }

  const permissions = getPermissionsForRole(user.role_name);
  const { token, expiresInSeconds } = signAuthToken({
    id: user.id,
    staffCode: user.staff_code,
    fullName: user.full_name,
    email: user.email,
    role: user.role_name,
    departmentId: user.department_id,
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      tokenType: 'Bearer',
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        staffCode: user.staff_code,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        specialization: user.specialization,
        qualification: user.qualification,
        consultationFee: user.consultation_fee,
        departmentId: user.department_id,
        departmentName: user.department_name,
        role: user.role_name,
        permissions,
      },
    },
  });
});

// GET /api/auth/departments (Public active departments lookup for registration page)
router.get('/departments', (_req, res) => {
  const departments = db
    .prepare(`SELECT id, department_code, name FROM departments WHERE status = 'ACTIVE' ORDER BY name ASC`)
    .all();
  res.json({ success: true, data: departments });
});

// POST /api/auth/register (Public registration for non-admin staff roles; ADMIN role requires authenticated ADMIN)
router.post('/register', (req, res) => {
  const { fullName, email, password, phone, roleName, departmentId, specialization, qualification, consultationFee } =
    req.body ?? {};

  if (
    typeof fullName !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof roleName !== 'string' ||
    !fullName.trim() ||
    !email.trim() ||
    !password ||
    !roleName.trim()
  ) {
    res.status(400).json({ success: false, message: 'Full name, email, password, and role are required.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    return;
  }

  const requestedRole = roleName.trim() as RoleName;
  const selfRegisterAllowedRoles: RoleName[] = ['REGISTRATION_STAFF', 'DOCTOR', 'PHARMACIST'];

  if (requestedRole === 'ADMIN') {
    const caller = verifyBearerUser(req.headers.authorization);
    if (caller?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Administrator accounts require existing Admin authorization. Please select Registration Staff, Doctor, or Pharmacist.',
      });
      return;
    }
  } else if (!selfRegisterAllowedRoles.includes(requestedRole)) {
    res.status(400).json({ success: false, message: 'Invalid role selected.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    return;
  }

  const role = db.prepare('SELECT id, name FROM roles WHERE name = ?').get(requestedRole) as
    | { id: number; name: RoleName }
    | undefined;
  if (!role) {
    res.status(400).json({ success: false, message: 'Invalid role specified.' });
    return;
  }

  let validDeptId: number | null = null;
  let deptName: string | null = null;
  if (departmentId !== undefined && departmentId !== null && String(departmentId).trim() !== '') {
    const dept = db
      .prepare(`SELECT id, name FROM departments WHERE id = ? AND status = 'ACTIVE'`)
      .get(Number(departmentId)) as { id: number; name: string } | undefined;
    if (!dept) {
      res.status(400).json({ success: false, message: 'Selected department is not valid.' });
      return;
    }
    validDeptId = dept.id;
    deptName = dept.name;
  }

  const prefixMap: Record<RoleName, string> = {
    ADMIN: 'STF-ADM',
    REGISTRATION_STAFF: 'STF-REG',
    DOCTOR: 'STF-DOC',
    PHARMACIST: 'STF-PHM',
  };
  const nextIdRow = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM users').get() as { nextId: number };
  const staffCode = `${prefixMap[role.name]}-${String(nextIdRow.nextId).padStart(3, '0')}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  const cleanName = fullName.trim();
  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
  const cleanSpec = typeof specialization === 'string' && specialization.trim() ? specialization.trim() : null;
  const cleanQual = typeof qualification === 'string' && qualification.trim() ? qualification.trim() : null;
  const parsedFee = role.name === 'DOCTOR' ? Math.max(0, Number(consultationFee ?? 500) || 500) : 0;

  const result = db
    .prepare(`
      INSERT INTO users (staff_code, full_name, email, password_hash, phone, specialization, qualification, consultation_fee, department_id, role_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `)
    .run(
      staffCode,
      cleanName,
      normalizedEmail,
      passwordHash,
      cleanPhone,
      cleanSpec,
      cleanQual,
      parsedFee,
      validDeptId,
      role.id
    );

  const createdUserId = Number(result.lastInsertRowid);
  const permissions = getPermissionsForRole(role.name);
  const { token, expiresInSeconds } = signAuthToken({
    id: createdUserId,
    staffCode,
    fullName: cleanName,
    email: normalizedEmail,
    role: role.name,
    departmentId: validDeptId,
  });

  res.status(201).json({
    success: true,
    message: 'User account registered successfully.',
    data: {
      token,
      tokenType: 'Bearer',
      expiresIn: expiresInSeconds,
      user: {
        id: createdUserId,
        staffCode,
        fullName: cleanName,
        email: normalizedEmail,
        phone: cleanPhone,
        specialization: cleanSpec,
        qualification: cleanQual,
        consultationFee: parsedFee,
        departmentId: validDeptId,
        departmentName: deptName,
        role: role.name,
        permissions,
      },
    },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.email, u.phone, u.specialization,
             u.qualification, u.consultation_fee, u.department_id, u.status,
             r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `)
    .get(req.user!.id) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  const permissions = getPermissionsForRole(String(user.role_name));
  res.json({
    success: true,
    data: {
      id: user.id,
      staffCode: user.staff_code,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      specialization: user.specialization,
      qualification: user.qualification,
      consultationFee: user.consultation_fee,
      departmentId: user.department_id,
      departmentName: user.department_name,
      role: user.role_name,
      status: user.status,
      permissions,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const token = req.headers.authorization?.slice(7).trim();
  if (req.user?.jti) {
    const decoded = token ? (jwt.decode(token) as { exp?: number } | null) : null;
    revokeToken(req.user.jti, decoded?.exp);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
