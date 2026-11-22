import { Router } from 'express';
import db from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';

const router = Router();

const ALLOWED_VISIT_TYPES = new Set(['OPD', 'IPD', 'EMERGENCY', 'FOLLOW_UP', 'DIAGNOSTIC', 'PHARMACY']);

function nowLocalIsoMinutes(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeDateTimeInput(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  // Normalize to YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 16);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function getVisitById(id: number) {
  return db
    .prepare(`
      SELECT pv.*,
             p.patient_code, p.full_name as patient_name, p.mobile_number as patient_mobile, p.age as patient_age, p.gender as patient_gender,
             d.name as department_name,
             doc.full_name as doctor_name,
             rec.full_name as recorded_by_name,
             chk.full_name as checked_out_by_name
      FROM patient_visits pv
      JOIN patients p ON pv.patient_id = p.id
      LEFT JOIN departments d ON pv.department_id = d.id
      LEFT JOIN users doc ON pv.doctor_id = doc.id
      LEFT JOIN users rec ON pv.recorded_by = rec.id
      LEFT JOIN users chk ON pv.checked_out_by = chk.id
      WHERE pv.id = ?
    `)
    .get(id) as Record<string, any> | undefined;
}

// LIST PATIENT VISITS (Check-in / Check-out Log & Filters)
router.get('/', requireAuth, (req, res) => {
  const patientId = req.query.patientId ? Number(req.query.patientId) : null;
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const date = String(req.query.date ?? '').trim();
  const search = String(req.query.search ?? '').trim();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (patientId && Number.isFinite(patientId)) {
    whereClauses.push('pv.patient_id = ?');
    params.push(patientId);
  }
  if (status === 'IN_HOSPITAL' || status === 'CHECKED_OUT') {
    whereClauses.push('pv.status = ?');
    params.push(status);
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    whereClauses.push('pv.visit_date = ?');
    params.push(date);
  }
  if (search) {
    whereClauses.push(
      '(UPPER(pv.visit_code) LIKE UPPER(?) OR UPPER(p.patient_code) LIKE UPPER(?) OR LOWER(p.full_name) LIKE LOWER(?) OR p.mobile_number LIKE ? OR LOWER(COALESCE(pv.purpose, \'\')) LIKE LOWER(?))'
    );
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const items = db
    .prepare(`
      SELECT pv.*,
             p.patient_code, p.full_name as patient_name, p.mobile_number as patient_mobile, p.age as patient_age, p.gender as patient_gender,
             d.name as department_name,
             doc.full_name as doctor_name,
             rec.full_name as recorded_by_name,
             chk.full_name as checked_out_by_name
      FROM patient_visits pv
      JOIN patients p ON pv.patient_id = p.id
      LEFT JOIN departments d ON pv.department_id = d.id
      LEFT JOIN users doc ON pv.doctor_id = doc.id
      LEFT JOIN users rec ON pv.recorded_by = rec.id
      LEFT JOIN users chk ON pv.checked_out_by = chk.id
      ${whereSql}
      ORDER BY pv.check_in_time DESC, pv.id DESC
      LIMIT ?
    `)
    .all(...params, limit);

  const todayStr = new Date().toISOString().slice(0, 10);
  const summary = db
    .prepare(`
      SELECT
        COUNT(*) as totalVisits,
        SUM(CASE WHEN status = 'IN_HOSPITAL' THEN 1 ELSE 0 END) as inHospitalCount,
        SUM(CASE WHEN status = 'CHECKED_OUT' AND visit_date = ? THEN 1 ELSE 0 END) as checkedOutTodayCount,
        SUM(CASE WHEN visit_date = ? THEN 1 ELSE 0 END) as todayTotalCount
      FROM patient_visits
    `)
    .get(todayStr, todayStr) as Record<string, number>;

  res.json({
    success: true,
    data: {
      items,
      summary: {
        totalVisits: Number(summary?.totalVisits ?? 0),
        inHospitalCount: Number(summary?.inHospitalCount ?? 0),
        checkedOutTodayCount: Number(summary?.checkedOutTodayCount ?? 0),
        todayTotalCount: Number(summary?.todayTotalCount ?? 0),
      },
    },
  });
});

// RECORD PATIENT ARRIVAL (CHECK-IN)
router.post('/check-in', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req: AuthenticatedRequest, res) => {
  const body = req.body ?? {};
  const patientId = Number(body.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    res.status(400).json({ success: false, message: 'Valid patient selection is required.' });
    return;
  }

  const patient = db.prepare('SELECT id, patient_code, full_name, assigned_department_id, assigned_doctor_id FROM patients WHERE id = ?').get(patientId) as
    | Record<string, any>
    | undefined;
  if (!patient) {
    res.status(404).json({ success: false, message: 'Selected patient not found.' });
    return;
  }

  const activeVisit = db
    .prepare(`SELECT id, visit_code, check_in_time FROM patient_visits WHERE patient_id = ? AND status = 'IN_HOSPITAL'`)
    .get(patientId) as Record<string, any> | undefined;
  if (activeVisit) {
    res.status(409).json({
      success: false,
      message: `${patient.full_name} (${patient.patient_code}) is already checked in under ${activeVisit.visit_code}. Record their check-out first.`,
    });
    return;
  }

  const checkInTime = normalizeDateTimeInput(body.checkInTime) ?? nowLocalIsoMinutes();
  const visitDate = checkInTime.slice(0, 10);
  const rawType = String(body.visitType ?? 'OPD').trim().toUpperCase();
  const visitType = ALLOWED_VISIT_TYPES.has(rawType) ? rawType : 'OPD';

  const departmentId = body.departmentId ? Number(body.departmentId) : patient.assigned_department_id ?? null;
  const doctorId = body.doctorId ? Number(body.doctorId) : patient.assigned_doctor_id ?? null;
  const appointmentId = body.appointmentId ? Number(body.appointmentId) : null;
  const purpose = body.purpose ? String(body.purpose).trim().slice(0, 300) : null;
  const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

  const created = db.transaction(() => {
    const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM patient_visits').get() as { m: number }).m;
    const visitCode = `VST-${visitDate.slice(0, 4)}-${String(maxId + 1).padStart(4, '0')}`;

    const info = db
      .prepare(`
        INSERT INTO patient_visits (
          visit_code, patient_id, department_id, doctor_id, appointment_id,
          visit_type, purpose, visit_date, check_in_time, status, notes, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_HOSPITAL', ?, ?)
      `)
      .run(
        visitCode,
        patientId,
        departmentId,
        doctorId,
        appointmentId,
        visitType,
        purpose,
        visitDate,
        checkInTime,
        notes,
        req.user!.id
      );

    return getVisitById(Number(info.lastInsertRowid));
  })();

  res.status(201).json({
    success: true,
    message: `Checked in ${patient.full_name} (${created?.visit_code}) at ${checkInTime.replace('T', ' ')}.`,
    data: created,
  });
});

// RECORD PATIENT DEPARTURE (CHECK-OUT)
router.put('/:id/check-out', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req: AuthenticatedRequest, res) => {
  const visitId = Number(req.params.id);
  if (!Number.isInteger(visitId) || visitId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid visit ID.' });
    return;
  }

  const visit = getVisitById(visitId);
  if (!visit) {
    res.status(404).json({ success: false, message: 'Visit record not found.' });
    return;
  }
  if (visit.status === 'CHECKED_OUT') {
    res.status(400).json({ success: false, message: `Visit ${visit.visit_code} is already checked out.` });
    return;
  }

  const body = req.body ?? {};
  const checkOutTime = normalizeDateTimeInput(body.checkOutTime) ?? nowLocalIsoMinutes();
  if (new Date(checkOutTime).getTime() < new Date(visit.check_in_time).getTime()) {
    res.status(400).json({
      success: false,
      message: 'Departure time cannot be earlier than arrival (check-in) time.',
    });
    return;
  }

  const nextNotes = body.notes !== undefined ? String(body.notes).trim().slice(0, 500) : visit.notes;

  db.prepare(`
    UPDATE patient_visits
    SET check_out_time = ?,
        status = 'CHECKED_OUT',
        notes = ?,
        checked_out_by = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(checkOutTime, nextNotes || null, req.user!.id, visitId);

  const updated = getVisitById(visitId);
  res.json({
    success: true,
    message: `${visit.patient_name} checked out (${visit.visit_code}) at ${checkOutTime.replace('T', ' ')}.`,
    data: updated,
  });
});

// UPDATE VISIT DETAILS (Correct Check-In / Check-Out Times or Purpose)
router.put('/:id', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req: AuthenticatedRequest, res) => {
  const visitId = Number(req.params.id);
  if (!Number.isInteger(visitId) || visitId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid visit ID.' });
    return;
  }

  const existing = getVisitById(visitId);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Visit record not found.' });
    return;
  }

  const body = req.body ?? {};
  const nextCheckIn = body.checkInTime ? normalizeDateTimeInput(body.checkInTime) : existing.check_in_time;
  if (!nextCheckIn) {
    res.status(400).json({ success: false, message: 'Valid arrival (check-in) date and time is required.' });
    return;
  }

  let nextCheckOut: string | null = existing.check_out_time;
  if (body.checkOutTime === '' || body.checkOutTime === null) {
    nextCheckOut = null;
  } else if (body.checkOutTime !== undefined) {
    const parsedOut = normalizeDateTimeInput(body.checkOutTime);
    if (!parsedOut) {
      res.status(400).json({ success: false, message: 'Invalid departure (check-out) date and time.' });
      return;
    }
    nextCheckOut = parsedOut;
  }

  if (nextCheckOut && new Date(nextCheckOut).getTime() < new Date(nextCheckIn).getTime()) {
    res.status(400).json({
      success: false,
      message: 'Departure time cannot be earlier than arrival time.',
    });
    return;
  }

  const nextStatus = nextCheckOut ? 'CHECKED_OUT' : 'IN_HOSPITAL';
  const nextDate = nextCheckIn.slice(0, 10);
  const rawType = body.visitType ? String(body.visitType).trim().toUpperCase() : existing.visit_type;
  const nextType = ALLOWED_VISIT_TYPES.has(rawType) ? rawType : existing.visit_type;

  db.prepare(`
    UPDATE patient_visits
    SET department_id = ?,
        doctor_id = ?,
        visit_type = ?,
        purpose = ?,
        visit_date = ?,
        check_in_time = ?,
        check_out_time = ?,
        status = ?,
        notes = ?,
        checked_out_by = CASE WHEN ? IS NOT NULL THEN COALESCE(checked_out_by, ?) ELSE NULL END,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.departmentId !== undefined ? (body.departmentId ? Number(body.departmentId) : null) : existing.department_id,
    body.doctorId !== undefined ? (body.doctorId ? Number(body.doctorId) : null) : existing.doctor_id,
    nextType,
    body.purpose !== undefined ? String(body.purpose).trim().slice(0, 300) || null : existing.purpose,
    nextDate,
    nextCheckIn,
    nextCheckOut,
    nextStatus,
    body.notes !== undefined ? String(body.notes).trim().slice(0, 500) || null : existing.notes,
    nextCheckOut,
    req.user!.id,
    visitId
  );

  const updated = getVisitById(visitId);
  res.json({
    success: true,
    message: `Visit ${existing.visit_code} updated.`,
    data: updated,
  });
});

// DELETE VISIT RECORD
router.delete('/:id', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req, res) => {
  const visitId = Number(req.params.id);
  if (!Number.isInteger(visitId) || visitId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid visit ID.' });
    return;
  }

  const existing = getVisitById(visitId);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Visit record not found.' });
    return;
  }

  db.prepare('DELETE FROM patient_visits WHERE id = ?').run(visitId);
  res.json({ success: true, message: `Visit ${existing.visit_code} removed.` });
});

export default router;
