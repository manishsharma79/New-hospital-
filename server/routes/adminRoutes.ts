import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole, RoleName } from '../auth.ts';

const router = Router();

// All Admin endpoints require authentication + ADMIN role (departments GET also useful for registration/dropdowns, handled separately or via /api/departments)
router.get('/dashboard', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const totalStaff = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'ACTIVE'").get() as { c: number }).c;
  const totalDoctors = (
    db.prepare("SELECT COUNT(*) as c FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'DOCTOR' AND u.status = 'ACTIVE'").get() as {
      c: number;
    }
  ).c;
  const totalPatients = (db.prepare('SELECT COUNT(*) as c FROM patients').get() as { c: number }).c;
  const totalDepartments = (db.prepare("SELECT COUNT(*) as c FROM departments WHERE status = 'ACTIVE'").get() as { c: number }).c;
  const totalAppointments = (db.prepare('SELECT COUNT(*) as c FROM appointments').get() as { c: number }).c;
  const totalRevenue = (
    db.prepare('SELECT COALESCE(SUM(paid_amount), 0) as total FROM billing').get() as { total: number }
  ).total;
  const totalBilled = (
    db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM billing').get() as { total: number }
  ).total;
  const pendingBills = (
    db.prepare("SELECT COUNT(*) as c FROM billing WHERE payment_status IN ('PENDING', 'PARTIAL')").get() as { c: number }
  ).c;

  const departmentBreakdown = db
    .prepare(`
      SELECT d.id, d.department_code, d.name, d.head_doctor_name,
             COUNT(DISTINCT u.id) as doctor_count,
             COUNT(DISTINCT a.id) as appointment_count,
             COUNT(DISTINCT p.id) as patient_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id AND u.role_id = (SELECT id FROM roles WHERE name = 'DOCTOR')
      LEFT JOIN appointments a ON a.department_id = d.id
      LEFT JOIN patients p ON p.assigned_department_id = d.id
      GROUP BY d.id
      ORDER BY d.id
    `)
    .all();

  const recentAppointments = db
    .prepare(`
      SELECT a.id, a.appointment_code, a.appointment_date, a.time_slot, a.status, a.visit_type,
             p.patient_code, p.full_name as patient_name,
             u.full_name as doctor_name, d.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON a.department_id = d.id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 6
    `)
    .all();

  res.json({
    success: true,
    data: {
      stats: {
        totalStaff,
        totalDoctors,
        totalPatients,
        totalDepartments,
        totalAppointments,
        totalRevenue,
        totalBilled,
        pendingBills,
      },
      departmentBreakdown,
      recentAppointments,
    },
  });
});

// Staff Management
router.get('/staff', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const rows = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.email, u.phone, u.specialization,
             u.qualification, u.consultation_fee, u.department_id, u.status, u.created_at,
             r.id as role_id, r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.id DESC
    `)
    .all();
  res.json({ success: true, data: rows });
});

router.post('/staff', requireAuth, requireRole('ADMIN'), (req, res) => {
  const { fullName, email, password, phone, roleName, departmentId, specialization, qualification, consultationFee, status } =
    req.body ?? {};
  if (!fullName || !email || !password || !roleName) {
    res.status(400).json({ success: false, message: 'fullName, email, password, and roleName are required.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim());
  if (existing) {
    res.status(409).json({ success: false, message: 'Email address is already in use.' });
    return;
  }

  const role = db.prepare('SELECT id, name FROM roles WHERE name = ?').get(String(roleName).trim()) as
    | { id: number; name: RoleName }
    | undefined;
  if (!role) {
    res.status(400).json({ success: false, message: 'Invalid role name.' });
    return;
  }

  const prefixMap: Record<RoleName, string> = {
    ADMIN: 'STF-ADM',
    REGISTRATION_STAFF: 'STF-REG',
    DOCTOR: 'STF-DOC',
    PHARMACIST: 'STF-PHM',
  };
  const nextNum = ((db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM users').get() as { m: number }).m || 0) + 1;
  const staffCode = `${prefixMap[role.name]}-${String(nextNum).padStart(3, '0')}`;
  const passwordHash = bcrypt.hashSync(String(password), 10);

  const info = db
    .prepare(`
      INSERT INTO users (staff_code, full_name, email, password_hash, phone, specialization, qualification, consultation_fee, department_id, role_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      staffCode,
      String(fullName).trim(),
      String(email).trim().toLowerCase(),
      passwordHash,
      phone ? String(phone).trim() : null,
      specialization ? String(specialization).trim() : null,
      qualification ? String(qualification).trim() : null,
      Number(consultationFee ?? 0),
      departmentId ? Number(departmentId) : null,
      role.id,
      status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
    );

  const created = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.email, u.phone, u.specialization,
             u.qualification, u.consultation_fee, u.department_id, u.status, u.created_at,
             r.id as role_id, r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `)
    .get(info.lastInsertRowid);

  res.status(201).json({ success: true, message: 'Staff member added.', data: created });
});

router.put('/staff/:id', requireAuth, requireRole('ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Staff member not found.' });
    return;
  }

  const { fullName, email, password, phone, roleName, departmentId, specialization, qualification, consultationFee, status } =
    req.body ?? {};
  const role = roleName
    ? (db.prepare('SELECT id FROM roles WHERE name = ?').get(String(roleName).trim()) as { id: number } | undefined)
    : undefined;
  if (roleName && !role) {
    res.status(400).json({ success: false, message: 'Invalid role name.' });
    return;
  }

  if (email) {
    const dup = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
      .get(String(email).trim(), id);
    if (dup) {
      res.status(409).json({ success: false, message: 'Another staff account already uses this email.' });
      return;
    }
  }

  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      specialization = COALESCE(?, specialization),
      qualification = COALESCE(?, qualification),
      consultation_fee = COALESCE(?, consultation_fee),
      department_id = ?,
      role_id = COALESCE(?, role_id),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    fullName ? String(fullName).trim() : null,
    email ? String(email).trim().toLowerCase() : null,
    phone !== undefined ? String(phone).trim() : null,
    specialization !== undefined ? String(specialization).trim() : null,
    qualification !== undefined ? String(qualification).trim() : null,
    consultationFee !== undefined ? Number(consultationFee) : null,
    departmentId !== undefined ? (departmentId ? Number(departmentId) : null) : null,
    role ? role.id : null,
    status ? String(status).trim() : null,
    id
  );

  if (password && String(password).trim().length >= 6) {
    const hash = bcrypt.hashSync(String(password), 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, id);
  }

  const updated = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.email, u.phone, u.specialization,
             u.qualification, u.consultation_fee, u.department_id, u.status, u.created_at,
             r.id as role_id, r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `)
    .get(id);

  res.json({ success: true, message: 'Staff member updated.', data: updated });
});

router.delete('/staff/:id', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (req.user?.id === id) {
    res.status(400).json({ success: false, message: 'You cannot delete your own active administrator account.' });
    return;
  }

  const hasLinkedRecords = db
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM appointments WHERE doctor_id = ?) +
        (SELECT COUNT(*) FROM medical_records WHERE doctor_id = ?) +
        (SELECT COUNT(*) FROM prescriptions WHERE doctor_id = ?) as refs
    `)
    .get(id, id, id) as { refs: number };

  if (hasLinkedRecords.refs > 0) {
    // Preserve clinical referential integrity by deactivating rather than orphan-deleting
    db.prepare("UPDATE users SET status = 'INACTIVE', updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({
      success: true,
      message: 'Staff member has linked clinical records and was marked INACTIVE to preserve audit integrity.',
    });
    return;
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ success: false, message: 'Staff member not found.' });
    return;
  }
  res.json({ success: true, message: 'Staff member deleted.' });
});

// Department Management
router.get('/departments', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const rows = db
    .prepare(`
      SELECT d.*,
             COUNT(DISTINCT u.id) as staff_count,
             COUNT(DISTINCT p.id) as patient_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id AND u.status = 'ACTIVE'
      LEFT JOIN patients p ON p.assigned_department_id = d.id
      GROUP BY d.id
      ORDER BY d.id
    `)
    .all();
  res.json({ success: true, data: rows });
});

router.post('/departments', requireAuth, requireRole('ADMIN'), (req, res) => {
  const { name, headDoctorName, location, phoneExt, description, status } = req.body ?? {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ success: false, message: 'Department name is required.' });
    return;
  }

  const dup = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)').get(String(name).trim());
  if (dup) {
    res.status(409).json({ success: false, message: 'A department with this name already exists.' });
    return;
  }

  const nextNum = ((db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM departments').get() as { m: number }).m || 0) + 1;
  const departmentCode = `DEPT-${String(nextNum).padStart(2, '0')}`;

  const info = db
    .prepare(`
      INSERT INTO departments (department_code, name, head_doctor_name, location, phone_ext, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      departmentCode,
      String(name).trim(),
      headDoctorName ? String(headDoctorName).trim() : null,
      location ? String(location).trim() : null,
      phoneExt ? String(phoneExt).trim() : null,
      description ? String(description).trim() : null,
      status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
    );

  const created = db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Department created.', data: created });
});

router.put('/departments/:id', requireAuth, requireRole('ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const { name, headDoctorName, location, phoneExt, description, status } = req.body ?? {};
  const existing = db.prepare('SELECT id FROM departments WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Department not found.' });
    return;
  }

  db.prepare(`
    UPDATE departments SET
      name = COALESCE(?, name),
      head_doctor_name = COALESCE(?, head_doctor_name),
      location = COALESCE(?, location),
      phone_ext = COALESCE(?, phone_ext),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ? String(name).trim() : null,
    headDoctorName !== undefined ? String(headDoctorName).trim() : null,
    location !== undefined ? String(location).trim() : null,
    phoneExt !== undefined ? String(phoneExt).trim() : null,
    description !== undefined ? String(description).trim() : null,
    status ? String(status).trim() : null,
    id
  );

  const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  res.json({ success: true, message: 'Department updated.', data: updated });
});

router.delete('/departments/:id', requireAuth, requireRole('ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const refs = db
    .prepare('SELECT (SELECT COUNT(*) FROM appointments WHERE department_id = ?) as c')
    .get(id) as { c: number };
  if (refs.c > 0) {
    db.prepare("UPDATE departments SET status = 'INACTIVE', updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true, message: 'Department has historical appointments and was marked INACTIVE.' });
    return;
  }
  const result = db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ success: false, message: 'Department not found.' });
    return;
  }
  res.json({ success: true, message: 'Department deleted.' });
});

// Roles & Permissions Management
router.get('/roles', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all() as Array<{ id: number; name: string; description: string }>;
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, id').all();
  const mappings = db.prepare('SELECT role_id, permission_id FROM role_permissions').all() as Array<{
    role_id: number;
    permission_id: number;
  }>;

  const enrichedRoles = roles.map((role) => ({
    ...role,
    permissionIds: mappings.filter((m) => m.role_id === role.id).map((m) => m.permission_id),
  }));

  res.json({ success: true, data: { roles: enrichedRoles, permissions } });
});

router.put('/roles/:id/permissions', requireAuth, requireRole('ADMIN'), (req, res) => {
  const roleId = Number(req.params.id);
  const { permissionIds } = req.body ?? {};
  if (!Array.isArray(permissionIds)) {
    res.status(400).json({ success: false, message: 'permissionIds array is required.' });
    return;
  }

  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
  if (!role) {
    res.status(404).json({ success: false, message: 'Role not found.' });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permissionIds) {
      ins.run(roleId, Number(pid));
    }
  });
  tx();

  res.json({ success: true, message: 'Role permissions updated successfully.' });
});

// Staff Schedules
router.get('/schedules', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const rows = db
    .prepare(`
      SELECT s.*, u.staff_code, u.full_name as staff_name, r.name as role_name, d.name as department_name
      FROM staff_schedules s
      JOIN users u ON s.staff_id = u.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON s.department_id = d.id
      ORDER BY u.full_name, s.id
    `)
    .all();
  res.json({ success: true, data: rows });
});

router.post('/schedules', requireAuth, requireRole('ADMIN'), (req, res) => {
  const { staffId, departmentId, dayOfWeek, startTime, endTime, slotDurationMinutes, maxPatients, roomNumber, isAvailable } =
    req.body ?? {};
  if (!staffId || !dayOfWeek || !startTime || !endTime) {
    res.status(400).json({ success: false, message: 'staffId, dayOfWeek, startTime, and endTime are required.' });
    return;
  }

  const info = db
    .prepare(`
      INSERT INTO staff_schedules (staff_id, department_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, room_number, is_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      Number(staffId),
      departmentId ? Number(departmentId) : null,
      String(dayOfWeek).toUpperCase(),
      String(startTime),
      String(endTime),
      Number(slotDurationMinutes ?? 30),
      Number(maxPatients ?? 14),
      roomNumber ? String(roomNumber).trim() : null,
      isAvailable === false || isAvailable === 0 ? 0 : 1
    );

  const created = db
    .prepare(`
      SELECT s.*, u.staff_code, u.full_name as staff_name, r.name as role_name, d.name as department_name
      FROM staff_schedules s
      JOIN users u ON s.staff_id = u.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `)
    .get(info.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Schedule entry created.', data: created });
});

router.put('/schedules/:id', requireAuth, requireRole('ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const { dayOfWeek, startTime, endTime, slotDurationMinutes, maxPatients, roomNumber, isAvailable } = req.body ?? {};
  const existing = db.prepare('SELECT id FROM staff_schedules WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Schedule entry not found.' });
    return;
  }

  db.prepare(`
    UPDATE staff_schedules SET
      day_of_week = COALESCE(?, day_of_week),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      slot_duration_minutes = COALESCE(?, slot_duration_minutes),
      max_patients = COALESCE(?, max_patients),
      room_number = COALESCE(?, room_number),
      is_available = COALESCE(?, is_available),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    dayOfWeek ? String(dayOfWeek).toUpperCase() : null,
    startTime ? String(startTime) : null,
    endTime ? String(endTime) : null,
    slotDurationMinutes !== undefined ? Number(slotDurationMinutes) : null,
    maxPatients !== undefined ? Number(maxPatients) : null,
    roomNumber !== undefined ? String(roomNumber) : null,
    isAvailable !== undefined ? (isAvailable ? 1 : 0) : null,
    id
  );
  res.json({ success: true, message: 'Schedule updated.' });
});

router.delete('/schedules/:id', requireAuth, requireRole('ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM staff_schedules WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ success: false, message: 'Schedule not found.' });
    return;
  }
  res.json({ success: true, message: 'Schedule deleted.' });
});

// Billing Overview & Hospital Activities
router.get('/billing-overview', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const summary = db
    .prepare(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total_billed,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(total_amount - paid_amount), 0) as total_outstanding,
        COALESCE(SUM(consultation_charges), 0) as consultation_revenue,
        COALESCE(SUM(medicine_charges), 0) as medicine_revenue,
        COALESCE(SUM(diagnostic_charges), 0) as diagnostic_revenue,
        COUNT(*) as total_invoices,
        SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN payment_status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN payment_status = 'PARTIAL' THEN 1 ELSE 0 END) as partial_count
      FROM billing
    `)
    .get();

  const bills = db
    .prepare(`
      SELECT b.*, p.patient_code, p.full_name as patient_name, u.full_name as billed_by_name
      FROM billing b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN users u ON b.billed_by = u.id
      ORDER BY b.billed_at DESC, b.id DESC
    `)
    .all();

  res.json({ success: true, data: { summary, bills } });
});

router.get('/activities', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const registrations = db
    .prepare(`
      SELECT 'PATIENT_REGISTERED' as type, patient_code as code, full_name as title,
             'Registered (' || registration_type || ')' as detail, created_at as timestamp
      FROM patients
      ORDER BY id DESC LIMIT 5
    `)
    .all();
  const appointments = db
    .prepare(`
      SELECT 'APPOINTMENT' as type, a.appointment_code as code, p.full_name as title,
             a.visit_type || ' · ' || a.status || ' with ' || u.full_name as detail, a.created_at as timestamp
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.id
      ORDER BY a.id DESC LIMIT 5
    `)
    .all();
  const prescriptions = db
    .prepare(`
      SELECT 'PRESCRIPTION' as type, pr.prescription_code as code, p.full_name as title,
             'Status: ' || pr.status || ' · Prescribed by ' || u.full_name as detail, pr.created_at as timestamp
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN users u ON pr.doctor_id = u.id
      ORDER BY pr.id DESC LIMIT 5
    `)
    .all();

  const combined = [...registrations, ...appointments, ...prescriptions]
    .sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 12);

  res.json({ success: true, data: combined });
});

export default router;
