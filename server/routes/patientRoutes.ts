import { Router } from 'express';
import db from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';

const router = Router();

function calculateAgeFromDob(dobStr: string): number {
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) {
    throw new Error('Invalid date of birth format.');
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

function resolvePatientRow(idOrCode: string) {
  if (/^\d+$/.test(idOrCode)) {
    return db
      .prepare(`
        SELECT p.*, d.name as department_name, u.full_name as doctor_name
        FROM patients p
        LEFT JOIN departments d ON p.assigned_department_id = d.id
        LEFT JOIN users u ON p.assigned_doctor_id = u.id
        WHERE p.id = ?
      `)
      .get(Number(idOrCode)) as Record<string, any> | undefined;
  }
  return db
    .prepare(`
      SELECT p.*, d.name as department_name, u.full_name as doctor_name
      FROM patients p
      LEFT JOIN departments d ON p.assigned_department_id = d.id
      LEFT JOIN users u ON p.assigned_doctor_id = u.id
      WHERE UPPER(p.patient_code) = UPPER(?)
    `)
    .get(idOrCode.trim()) as Record<string, any> | undefined;
}

// PROCESS 0.2.1 - NEW PATIENT REGISTRATION
router.post('/', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req: AuthenticatedRequest, res) => {
  const body = req.body ?? {};
  const requiredFields = [
    ['fullName', 'Full Name'],
    ['dob', 'Date of Birth'],
    ['gender', 'Gender'],
    ['mobileNumber', 'Mobile Number'],
    ['city', 'City'],
    ['state', 'State / UT'],
    ['emergencyContactName', 'Emergency Contact Name'],
    ['emergencyRelationship', 'Emergency Relationship'],
    ['emergencyContactNumber', 'Emergency Contact Number'],
  ];

  for (const [key, label] of requiredFields) {
    if (!body[key] || !String(body[key]).trim()) {
      res.status(400).json({ success: false, message: `${label} is required.` });
      return;
    }
  }

  let age: number;
  try {
    age = calculateAgeFromDob(String(body.dob));
  } catch {
    res.status(400).json({ success: false, message: 'Invalid Date of Birth.' });
    return;
  }

  const tx = db.transaction(() => {
    const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM patients').get() as { m: number }).m;
    const patientCode = `HMIS-PAT-${String(maxId + 1).padStart(4, '0')}`;
    const regDate = body.registrationDate ? String(body.registrationDate).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const info = db
      .prepare(`
        INSERT INTO patients (
          patient_code, full_name, dob, age, gender, blood_group, marital_status,
          mobile_number, alternate_phone, email,
          house_number, street_locality, city, state, country, pin_code,
          emergency_contact_name, emergency_relationship, emergency_contact_number,
          id_proof_type, id_proof_number, registration_date, registration_type,
          assigned_department_id, assigned_doctor_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        patientCode,
        String(body.fullName).trim(),
        String(body.dob).slice(0, 10),
        age,
        String(body.gender).trim(),
        body.bloodGroup ? String(body.bloodGroup).trim() : null,
        body.maritalStatus ? String(body.maritalStatus).trim() : null,
        String(body.mobileNumber).trim(),
        body.alternatePhone ? String(body.alternatePhone).trim() : null,
        body.email ? String(body.email).trim() : null,
        body.houseNumber ? String(body.houseNumber).trim() : null,
        body.streetLocality ? String(body.streetLocality).trim() : null,
        String(body.city).trim(),
        String(body.state).trim(),
        body.country ? String(body.country).trim() : 'India',
        body.pinCode ? String(body.pinCode).trim() : null,
        String(body.emergencyContactName).trim(),
        String(body.emergencyRelationship).trim(),
        String(body.emergencyContactNumber).trim(),
        body.idProofType ? String(body.idProofType).trim() : null,
        body.idProofNumber ? String(body.idProofNumber).trim() : null,
        regDate,
        body.registrationType ? String(body.registrationType).trim().toUpperCase() : 'OPD',
        body.assignedDepartmentId ? Number(body.assignedDepartmentId) : null,
        body.assignedDoctorId ? Number(body.assignedDoctorId) : null,
        req.user!.id
      );

    return resolvePatientRow(String(info.lastInsertRowid));
  });

  const created = tx();
  res.status(201).json({
    success: true,
    message: `Patient registered with ID ${created?.patient_code}`,
    data: created,
  });
});

// PROCESS 0.2.2 - SEARCH PATIENT
router.get('/search', requireAuth, (req, res) => {
  const q = String(req.query.q ?? req.query.patientId ?? '').trim();
  if (!q) {
    res.json({ success: true, data: [] });
    return;
  }
  const like = `%${q}%`;
  const rows = db
    .prepare(`
      SELECT p.*, d.name as department_name, u.full_name as doctor_name
      FROM patients p
      LEFT JOIN departments d ON p.assigned_department_id = d.id
      LEFT JOIN users u ON p.assigned_doctor_id = u.id
      WHERE UPPER(p.patient_code) LIKE UPPER(?)
         OR LOWER(p.full_name) LIKE LOWER(?)
         OR p.mobile_number LIKE ?
      ORDER BY p.id DESC
      LIMIT 25
    `)
    .all(like, like, like);
  res.json({ success: true, data: rows });
});

// GET ALL PATIENTS (Search, Filter, Sort, Pagination)
router.get('/', requireAuth, (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const gender = String(req.query.gender ?? '').trim();
  const bloodGroup = String(req.query.bloodGroup ?? '').trim();
  const registrationType = String(req.query.registrationType ?? '').trim();
  const sortBy = String(req.query.sortBy ?? 'id');
  const sortDir = String(req.query.sortDir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const allowedSortColumns: Record<string, string> = {
    id: 'p.id',
    patient_code: 'p.patient_code',
    full_name: 'p.full_name',
    age: 'p.age',
    registration_date: 'p.registration_date',
  };
  const orderCol = allowedSortColumns[sortBy] ?? 'p.id';

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    whereClauses.push('(UPPER(p.patient_code) LIKE UPPER(?) OR LOWER(p.full_name) LIKE LOWER(?) OR p.mobile_number LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (gender) {
    whereClauses.push('p.gender = ?');
    params.push(gender);
  }
  if (bloodGroup) {
    whereClauses.push('p.blood_group = ?');
    params.push(bloodGroup);
  }
  if (registrationType) {
    whereClauses.push('p.registration_type = ?');
    params.push(registrationType);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM patients p ${whereSql}`).get(...params) as { cnt: number }
  ).cnt;

  const items = db
    .prepare(`
      SELECT p.*, d.name as department_name, u.full_name as doctor_name
      FROM patients p
      LEFT JOIN departments d ON p.assigned_department_id = d.id
      LEFT JOIN users u ON p.assigned_doctor_id = u.id
      ${whereSql}
      ORDER BY ${orderCol} ${sortDir}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
});

// GET SINGLE PATIENT
router.get('/:id', requireAuth, (req, res) => {
  const patient = resolvePatientRow(String(req.params.id));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }
  res.json({ success: true, data: patient });
});

// PROCESS 0.2.3 - UPDATE PATIENT DETAILS
router.put('/:id', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req, res) => {
  const patient = resolvePatientRow(String(req.params.id));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }

  const body = req.body ?? {};
  const nextDob = body.dob ? String(body.dob).slice(0, 10) : patient.dob;
  let age = patient.age;
  try {
    age = calculateAgeFromDob(nextDob);
  } catch {
    res.status(400).json({ success: false, message: 'Invalid Date of Birth.' });
    return;
  }

  db.prepare(`
    UPDATE patients SET
      full_name = COALESCE(?, full_name),
      dob = ?,
      age = ?,
      gender = COALESCE(?, gender),
      blood_group = COALESCE(?, blood_group),
      marital_status = COALESCE(?, marital_status),
      mobile_number = COALESCE(?, mobile_number),
      alternate_phone = COALESCE(?, alternate_phone),
      email = COALESCE(?, email),
      house_number = COALESCE(?, house_number),
      street_locality = COALESCE(?, street_locality),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      country = COALESCE(?, country),
      pin_code = COALESCE(?, pin_code),
      emergency_contact_name = COALESCE(?, emergency_contact_name),
      emergency_relationship = COALESCE(?, emergency_relationship),
      emergency_contact_number = COALESCE(?, emergency_contact_number),
      id_proof_type = COALESCE(?, id_proof_type),
      id_proof_number = COALESCE(?, id_proof_number),
      registration_type = COALESCE(?, registration_type),
      assigned_department_id = ?,
      assigned_doctor_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.fullName ? String(body.fullName).trim() : null,
    nextDob,
    age,
    body.gender ? String(body.gender).trim() : null,
    body.bloodGroup !== undefined ? String(body.bloodGroup).trim() : null,
    body.maritalStatus !== undefined ? String(body.maritalStatus).trim() : null,
    body.mobileNumber ? String(body.mobileNumber).trim() : null,
    body.alternatePhone !== undefined ? String(body.alternatePhone).trim() : null,
    body.email !== undefined ? String(body.email).trim() : null,
    body.houseNumber !== undefined ? String(body.houseNumber).trim() : null,
    body.streetLocality !== undefined ? String(body.streetLocality).trim() : null,
    body.city ? String(body.city).trim() : null,
    body.state ? String(body.state).trim() : null,
    body.country ? String(body.country).trim() : null,
    body.pinCode !== undefined ? String(body.pinCode).trim() : null,
    body.emergencyContactName ? String(body.emergencyContactName).trim() : null,
    body.emergencyRelationship ? String(body.emergencyRelationship).trim() : null,
    body.emergencyContactNumber ? String(body.emergencyContactNumber).trim() : null,
    body.idProofType !== undefined ? String(body.idProofType).trim() : null,
    body.idProofNumber !== undefined ? String(body.idProofNumber).trim() : null,
    body.registrationType ? String(body.registrationType).trim().toUpperCase() : null,
    body.assignedDepartmentId !== undefined ? (body.assignedDepartmentId ? Number(body.assignedDepartmentId) : null) : patient.assigned_department_id,
    body.assignedDoctorId !== undefined ? (body.assignedDoctorId ? Number(body.assignedDoctorId) : null) : patient.assigned_doctor_id,
    patient.id
  );

  const updated = resolvePatientRow(String(patient.id));
  res.json({ success: true, message: 'Patient details updated successfully.', data: updated });
});

// DELETE PATIENT
router.delete('/:id', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req, res) => {
  const patient = resolvePatientRow(String(req.params.id));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }

  db.prepare('DELETE FROM patients WHERE id = ?').run(patient.id);
  res.json({ success: true, message: `Patient ${patient.patient_code} deleted.` });
});

// PATIENT COMPLETE HISTORY
router.get('/:id/history', requireAuth, (req, res) => {
  const patient = resolvePatientRow(String(req.params.id));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }

  const appointments = db
    .prepare(`
      SELECT a.*, u.full_name as doctor_name, d.name as department_name
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date DESC, a.time_slot DESC
    `)
    .all(patient.id);

  const medicalRecords = db
    .prepare(`
      SELECT mr.*, u.full_name as doctor_name, u.specialization
      FROM medical_records mr
      JOIN users u ON mr.doctor_id = u.id
      WHERE mr.patient_id = ?
      ORDER BY mr.visit_date DESC, mr.id DESC
    `)
    .all(patient.id);

  const prescriptions = db
    .prepare(`
      SELECT pr.*, u.full_name as doctor_name, v.full_name as verified_by_name
      FROM prescriptions pr
      JOIN users u ON pr.doctor_id = u.id
      LEFT JOIN users v ON pr.verified_by = v.id
      WHERE pr.patient_id = ?
      ORDER BY pr.prescribed_date DESC, pr.id DESC
    `)
    .all(patient.id) as Array<Record<string, any>>;

  const getItems = db.prepare(`
    SELECT pi.*, m.medicine_name, m.medicine_code, m.unit_price
    FROM prescription_items pi
    JOIN medicines m ON pi.medicine_id = m.id
    WHERE pi.prescription_id = ?
  `);

  const enrichedPrescriptions = prescriptions.map((pr) => ({
    ...pr,
    items: getItems.all(pr.id),
  }));

  const diagnosticTests = db
    .prepare(`
      SELECT dt.*, u.full_name as doctor_name
      FROM diagnostic_tests dt
      JOIN users u ON dt.doctor_id = u.id
      WHERE dt.patient_id = ?
      ORDER BY dt.requested_date DESC, dt.id DESC
    `)
    .all(patient.id);

  const bills = db
    .prepare(`
      SELECT b.*, u.full_name as billed_by_name
      FROM billing b
      LEFT JOIN users u ON b.billed_by = u.id
      WHERE b.patient_id = ?
      ORDER BY b.billed_at DESC, b.id DESC
    `)
    .all(patient.id);

  const visits = db
    .prepare(`
      SELECT pv.*,
             d.name as department_name,
             doc.full_name as doctor_name,
             rec.full_name as recorded_by_name,
             chk.full_name as checked_out_by_name
      FROM patient_visits pv
      LEFT JOIN departments d ON pv.department_id = d.id
      LEFT JOIN users doc ON pv.doctor_id = doc.id
      LEFT JOIN users rec ON pv.recorded_by = rec.id
      LEFT JOIN users chk ON pv.checked_out_by = chk.id
      WHERE pv.patient_id = ?
      ORDER BY pv.check_in_time DESC, pv.id DESC
    `)
    .all(patient.id);

  res.json({
    success: true,
    data: {
      patient,
      visits,
      appointments,
      medicalRecords,
      prescriptions: enrichedPrescriptions,
      diagnosticTests,
      bills,
    },
  });
});

export default router;
