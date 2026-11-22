import { Router } from 'express';
import db from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';

const router = Router();

// ==================== DOCTOR MODULE ====================

router.get('/doctor/dashboard', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const doctorId = req.user!.id;
  const isDoctor = req.user!.role === 'DOCTOR';

  const appointmentsCount = isDoctor
    ? (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE doctor_id = ? AND status = 'SCHEDULED'").get(doctorId) as { c: number }).c
    : (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'SCHEDULED'").get() as { c: number }).c;

  const totalAssignedPatients = isDoctor
    ? (
        db
          .prepare(
            'SELECT COUNT(DISTINCT id) as c FROM patients WHERE assigned_doctor_id = ? OR id IN (SELECT patient_id FROM appointments WHERE doctor_id = ?)'
          )
          .get(doctorId, doctorId) as { c: number }
      ).c
    : (db.prepare('SELECT COUNT(*) as c FROM patients').get() as { c: number }).c;

  const medicalRecordsCount = isDoctor
    ? (db.prepare('SELECT COUNT(*) as c FROM medical_records WHERE doctor_id = ?').get(doctorId) as { c: number }).c
    : (db.prepare('SELECT COUNT(*) as c FROM medical_records').get() as { c: number }).c;

  const pendingTestsCount = isDoctor
    ? (
        db
          .prepare("SELECT COUNT(*) as c FROM diagnostic_tests WHERE doctor_id = ? AND status != 'COMPLETED'")
          .get(doctorId) as { c: number }
      ).c
    : (db.prepare("SELECT COUNT(*) as c FROM diagnostic_tests WHERE status != 'COMPLETED'").get() as { c: number }).c;

  const prescriptionsCount = isDoctor
    ? (db.prepare('SELECT COUNT(*) as c FROM prescriptions WHERE doctor_id = ?').get(doctorId) as { c: number }).c
    : (db.prepare('SELECT COUNT(*) as c FROM prescriptions').get() as { c: number }).c;

  const upcomingAppointments = db
    .prepare(`
      SELECT a.*, p.patient_code, p.full_name as patient_name, p.age, p.gender, p.blood_group,
             d.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN departments d ON a.department_id = d.id
      ${isDoctor ? 'WHERE a.doctor_id = ?' : ''}
      ORDER BY CASE WHEN a.status = 'SCHEDULED' THEN 0 ELSE 1 END, a.appointment_date DESC, a.time_slot ASC
      LIMIT 10
    `)
    .all(...(isDoctor ? [doctorId] : []));

  res.json({
    success: true,
    data: {
      stats: {
        scheduledAppointments: appointmentsCount,
        assignedPatients: totalAssignedPatients,
        medicalRecords: medicalRecordsCount,
        pendingDiagnostics: pendingTestsCount,
        prescriptionsIssued: prescriptionsCount,
      },
      upcomingAppointments,
    },
  });
});

router.get('/doctor/patients', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const scope = String(req.query.scope ?? 'all');
  const search = String(req.query.search ?? '').trim();

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (scope === 'assigned' && req.user!.role === 'DOCTOR') {
    where.push('(p.assigned_doctor_id = ? OR p.id IN (SELECT patient_id FROM appointments WHERE doctor_id = ?))');
    params.push(req.user!.id, req.user!.id);
  }
  if (search) {
    where.push('(UPPER(p.patient_code) LIKE UPPER(?) OR LOWER(p.full_name) LIKE LOWER(?) OR p.mobile_number LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT p.*, d.name as department_name, u.full_name as doctor_name,
             (SELECT COUNT(*) FROM medical_records mr WHERE mr.patient_id = p.id) as record_count
      FROM patients p
      LEFT JOIN departments d ON p.assigned_department_id = d.id
      LEFT JOIN users u ON p.assigned_doctor_id = u.id
      ${whereSql}
      ORDER BY p.id DESC
    `)
    .all(...params);

  res.json({ success: true, data: rows });
});

router.get('/doctor/records', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const patientId = req.query.patientId ? Number(req.query.patientId) : null;
  const where: string[] = [];
  const params: number[] = [];
  if (patientId) {
    where.push('mr.patient_id = ?');
    params.push(patientId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT mr.*, p.patient_code, p.full_name as patient_name, p.age, p.gender,
             u.full_name as doctor_name, u.specialization
      FROM medical_records mr
      JOIN patients p ON mr.patient_id = p.id
      JOIN users u ON mr.doctor_id = u.id
      ${whereSql}
      ORDER BY mr.visit_date DESC, mr.id DESC
    `)
    .all(...params);
  res.json({ success: true, data: rows });
});

// PROCESS 0.4 - ADD DIAGNOSIS
router.post('/doctor/diagnosis', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const {
    patientId,
    appointmentId,
    chiefComplaint,
    diagnosis,
    treatmentPlan,
    clinicalNotes,
    progressStatus,
    vitalsBp,
    vitalsTemp,
    vitalsPulse,
  } = req.body ?? {};

  if (!patientId || !diagnosis || !String(diagnosis).trim()) {
    res.status(400).json({ success: false, message: 'patientId and diagnosis are required.' });
    return;
  }

  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(patientId));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }

  const tx = db.transaction(() => {
    const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM medical_records').get() as { m: number }).m;
    const recordCode = `MR-2026-${String(maxId + 1).padStart(4, '0')}`;
    const visitDate = new Date().toISOString().slice(0, 10);

    const info = db
      .prepare(`
        INSERT INTO medical_records (
          record_code, patient_id, doctor_id, appointment_id, visit_date,
          chief_complaint, diagnosis, treatment_plan, clinical_notes,
          progress_status, vitals_bp, vitals_temp, vitals_pulse
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        recordCode,
        Number(patientId),
        req.user!.id,
        appointmentId ? Number(appointmentId) : null,
        visitDate,
        chiefComplaint ? String(chiefComplaint).trim() : null,
        String(diagnosis).trim(),
        treatmentPlan ? String(treatmentPlan).trim() : 'Initial clinical evaluation recorded',
        clinicalNotes ? String(clinicalNotes).trim() : null,
        progressStatus ? String(progressStatus).trim().toUpperCase() : 'UNDER_OBSERVATION',
        vitalsBp ? String(vitalsBp).trim() : null,
        vitalsTemp ? String(vitalsTemp).trim() : null,
        vitalsPulse ? String(vitalsPulse).trim() : null
      );

    if (appointmentId) {
      db.prepare("UPDATE appointments SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ?").run(
        Number(appointmentId)
      );
    }

    return db
      .prepare(`
        SELECT mr.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
        FROM medical_records mr
        JOIN patients p ON mr.patient_id = p.id
        JOIN users u ON mr.doctor_id = u.id
        WHERE mr.id = ?
      `)
      .get(info.lastInsertRowid);
  });

  const created = tx();
  res.status(201).json({ success: true, message: 'Clinical diagnosis recorded.', data: created });
});

// PROCESS 0.4 - ADD / UPDATE TREATMENT
router.post('/doctor/treatment', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const { recordId, patientId, treatmentPlan, clinicalNotes } = req.body ?? {};
  if (!treatmentPlan || !String(treatmentPlan).trim()) {
    res.status(400).json({ success: false, message: 'treatmentPlan is required.' });
    return;
  }

  if (recordId) {
    const rec = db.prepare('SELECT id FROM medical_records WHERE id = ?').get(Number(recordId));
    if (!rec) {
      res.status(404).json({ success: false, message: 'Medical record not found.' });
      return;
    }
    db.prepare(`
      UPDATE medical_records SET
        treatment_plan = ?,
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(String(treatmentPlan).trim(), clinicalNotes ? String(clinicalNotes).trim() : null, Number(recordId));

    const updated = db.prepare('SELECT * FROM medical_records WHERE id = ?').get(Number(recordId));
    res.json({ success: true, message: 'Treatment plan updated.', data: updated });
    return;
  }

  if (!patientId) {
    res.status(400).json({ success: false, message: 'Either recordId or patientId is required.' });
    return;
  }

  const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM medical_records').get() as { m: number }).m;
  const recordCode = `MR-2026-${String(maxId + 1).padStart(4, '0')}`;
  const info = db
    .prepare(`
      INSERT INTO medical_records (record_code, patient_id, doctor_id, visit_date, diagnosis, treatment_plan, clinical_notes, progress_status)
      VALUES (?, ?, ?, ?, 'Ongoing Clinical Care', ?, ?, 'IMPROVING')
    `)
    .run(
      recordCode,
      Number(patientId),
      req.user!.id,
      new Date().toISOString().slice(0, 10),
      String(treatmentPlan).trim(),
      clinicalNotes ? String(clinicalNotes).trim() : null
    );
  const created = db.prepare('SELECT * FROM medical_records WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Treatment entry added.', data: created });
});

// PROCESS 0.4 - UPDATE PATIENT PROGRESS
router.put('/doctor/progress', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req, res) => {
  const { recordId, progressStatus, clinicalNotes } = req.body ?? {};
  if (!recordId || !progressStatus) {
    res.status(400).json({ success: false, message: 'recordId and progressStatus are required.' });
    return;
  }

  const rec = db.prepare('SELECT id FROM medical_records WHERE id = ?').get(Number(recordId));
  if (!rec) {
    res.status(404).json({ success: false, message: 'Medical record not found.' });
    return;
  }

  db.prepare(`
    UPDATE medical_records SET
      progress_status = ?,
      clinical_notes = COALESCE(?, clinical_notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(String(progressStatus).trim().toUpperCase(), clinicalNotes ? String(clinicalNotes).trim() : null, Number(recordId));

  const updated = db
    .prepare(`
      SELECT mr.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
      FROM medical_records mr
      JOIN patients p ON mr.patient_id = p.id
      JOIN users u ON mr.doctor_id = u.id
      WHERE mr.id = ?
    `)
    .get(Number(recordId));

  res.json({ success: true, message: 'Patient progress updated.', data: updated });
});

router.get('/doctor/reports', requireAuth, requireRole('DOCTOR', 'ADMIN'), (_req, res) => {
  const rows = db
    .prepare(`
      SELECT dt.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
      FROM diagnostic_tests dt
      JOIN patients p ON dt.patient_id = p.id
      JOIN users u ON dt.doctor_id = u.id
      ORDER BY dt.requested_date DESC, dt.id DESC
    `)
    .all();
  res.json({ success: true, data: rows });
});

// ==================== PRESCRIPTIONS MODULE ====================

function enrichPrescriptions(rows: Array<Record<string, any>>): Array<Record<string, any>> {
  const getItems = db.prepare(`
    SELECT pi.*, m.medicine_code, m.medicine_name, m.batch_number, m.unit_price, m.available_quantity, m.expiry_date
    FROM prescription_items pi
    JOIN medicines m ON pi.medicine_id = m.id
    WHERE pi.prescription_id = ?
  `);
  const getDiagSum = db.prepare(
    'SELECT COALESCE(SUM(test_charge), 0) as total FROM diagnostic_tests WHERE appointment_id = ?'
  );
  return rows.map((r) => {
    const items = getItems.all(r.id) as Array<Record<string, any>>;
    const estimatedMedicineTotal = items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity_prescribed),
      0
    );
    const diagnosticCharges = r.appointment_id
      ? Number((getDiagSum.get(r.appointment_id) as { total: number } | undefined)?.total ?? 0)
      : 0;
    return { ...r, items, estimatedMedicineTotal, diagnosticCharges };
  });
}

router.get('/prescriptions', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const patientId = req.query.patientId ? Number(req.query.patientId) : null;
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (status) {
    where.push('pr.status = ?');
    params.push(status.toUpperCase());
  }
  if (patientId) {
    where.push('pr.patient_id = ?');
    params.push(patientId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT pr.*, p.patient_code, p.full_name as patient_name, p.age as patient_age,
             p.gender as patient_gender, p.mobile_number as patient_mobile,
             u.full_name as doctor_name, u.specialization as doctor_specialization, u.consultation_fee,
             v.full_name as verified_by_name,
             b.id as bill_id, b.bill_code, b.payment_status as bill_payment_status
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN users u ON pr.doctor_id = u.id
      LEFT JOIN users v ON pr.verified_by = v.id
      LEFT JOIN billing b ON b.prescription_id = pr.id
      ${whereSql}
      ORDER BY pr.prescribed_date DESC, pr.id DESC
    `)
    .all(...params) as Array<Record<string, any>>;

  res.json({ success: true, data: enrichPrescriptions(rows) });
});

router.get('/prescriptions/:id', requireAuth, (req, res) => {
  const row = db
    .prepare(`
      SELECT pr.*, p.patient_code, p.full_name as patient_name, p.age as patient_age,
             p.gender as patient_gender, p.mobile_number as patient_mobile,
             u.full_name as doctor_name, u.specialization as doctor_specialization, u.consultation_fee,
             v.full_name as verified_by_name,
             b.id as bill_id, b.bill_code, b.payment_status as bill_payment_status
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN users u ON pr.doctor_id = u.id
      LEFT JOIN users v ON pr.verified_by = v.id
      LEFT JOIN billing b ON b.prescription_id = pr.id
      WHERE pr.id = ?
    `)
    .get(Number(req.params.id)) as Record<string, any> | undefined;

  if (!row) {
    res.status(404).json({ success: false, message: 'Prescription not found.' });
    return;
  }
  res.json({ success: true, data: enrichPrescriptions([row])[0] });
});

router.post('/prescriptions', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const { patientId, appointmentId, medicalRecordId, notes, items } = req.body ?? {};
  if (!patientId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, message: 'patientId and at least one medicine item are required.' });
    return;
  }

  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(patientId));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }

  try {
    const created = db.transaction(() => {
      const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM prescriptions').get() as { m: number }).m;
      const rxCode = `RX-2026-${String(maxId + 1).padStart(4, '0')}`;
      const today = new Date().toISOString().slice(0, 10);

      const info = db
        .prepare(`
          INSERT INTO prescriptions (prescription_code, patient_id, doctor_id, appointment_id, medical_record_id, prescribed_date, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `)
        .run(
          rxCode,
          Number(patientId),
          req.user!.id,
          appointmentId ? Number(appointmentId) : null,
          medicalRecordId ? Number(medicalRecordId) : null,
          today,
          notes ? String(notes).trim() : null
        );

      const insertItem = db.prepare(`
        INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity_prescribed, instructions)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const med = db.prepare('SELECT id, medicine_name FROM medicines WHERE id = ?').get(Number(item.medicineId)) as
          | { id: number; medicine_name: string }
          | undefined;
        if (!med) {
          throw { status: 404, message: `Medicine ID ${item.medicineId} does not exist.` };
        }
        const qty = Math.max(1, Number(item.quantityPrescribed ?? 1));
        insertItem.run(
          info.lastInsertRowid,
          med.id,
          String(item.dosage ?? 'Standard').trim(),
          String(item.frequency ?? 'Once daily').trim(),
          Math.max(1, Number(item.durationDays ?? 5)),
          qty,
          item.instructions ? String(item.instructions).trim() : null
        );
      }

      const row = db
        .prepare(`
          SELECT pr.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
          FROM prescriptions pr
          JOIN patients p ON pr.patient_id = p.id
          JOIN users u ON pr.doctor_id = u.id
          WHERE pr.id = ?
        `)
        .get(info.lastInsertRowid) as Record<string, any>;

      return enrichPrescriptions([row])[0];
    })();

    res.status(201).json({ success: true, message: 'Prescription issued successfully.', data: created });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create prescription.' });
  }
});

// PHARMACIST VERIFY & DISPENSE PRESCRIPTION (transactional stock deduction + expiry block + duplicate dispense guard)
router.put('/prescriptions/:id/verify', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    const updated = db.transaction(() => {
      const rx = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id) as Record<string, any> | undefined;
      if (!rx) {
        throw { status: 404, message: 'Prescription not found.' };
      }
      if (rx.status === 'DISPENSED' || rx.status === 'VERIFIED') {
        throw {
          status: 409,
          message: `Duplicate dispensing blocked: Prescription ${rx.prescription_code} has already been ${rx.status.toLowerCase()}.`,
        };
      }

      const items = db
        .prepare(`
          SELECT pi.*, m.medicine_name, m.available_quantity, m.expiry_date, m.batch_number
          FROM prescription_items pi
          JOIN medicines m ON pi.medicine_id = m.id
          WHERE pi.prescription_id = ?
        `)
        .all(id) as Array<Record<string, any>>;

      if (items.length === 0) {
        throw { status: 400, message: 'Prescription has no items to dispense.' };
      }

      for (const item of items) {
        if (String(item.expiry_date) < todayStr) {
          throw {
            status: 422,
            message: `Expired medicine safety block: ${item.medicine_name} (Batch ${item.batch_number}) expired on ${item.expiry_date}.`,
          };
        }
        if (Number(item.available_quantity) < Number(item.quantity_prescribed)) {
          throw {
            status: 422,
            message: `Insufficient stock for ${item.medicine_name}: requested ${item.quantity_prescribed}, available ${item.available_quantity}.`,
          };
        }
      }

      const deductStock = db.prepare(
        "UPDATE medicines SET available_quantity = available_quantity - ?, updated_at = datetime('now') WHERE id = ?"
      );
      for (const item of items) {
        deductStock.run(Number(item.quantity_prescribed), Number(item.medicine_id));
      }

      db.prepare(`
        UPDATE prescriptions SET
          status = 'DISPENSED',
          verified_by = ?,
          verified_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(req.user!.id, id);

      const row = db
        .prepare(`
          SELECT pr.*, p.patient_code, p.full_name as patient_name, p.age as patient_age,
                 p.gender as patient_gender, p.mobile_number as patient_mobile,
                 u.full_name as doctor_name, u.specialization as doctor_specialization, u.consultation_fee,
                 v.full_name as verified_by_name,
                 b.id as bill_id, b.bill_code, b.payment_status as bill_payment_status
          FROM prescriptions pr
          JOIN patients p ON pr.patient_id = p.id
          JOIN users u ON pr.doctor_id = u.id
          LEFT JOIN users v ON pr.verified_by = v.id
          LEFT JOIN billing b ON b.prescription_id = pr.id
          WHERE pr.id = ?
        `)
        .get(id) as Record<string, any>;

      return enrichPrescriptions([row])[0];
    })();

    res.json({
      success: true,
      message: `Prescription ${updated.prescription_code} verified and stock deducted.`,
      data: updated,
    });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to verify prescription.' });
  }
});

// ==================== DIAGNOSTIC TESTS MODULE ====================

router.get('/diagnostic-tests', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const patientId = req.query.patientId ? Number(req.query.patientId) : null;
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (status) {
    where.push('dt.status = ?');
    params.push(status.toUpperCase());
  }
  if (patientId) {
    where.push('dt.patient_id = ?');
    params.push(patientId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT dt.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
      FROM diagnostic_tests dt
      JOIN patients p ON dt.patient_id = p.id
      JOIN users u ON dt.doctor_id = u.id
      ${whereSql}
      ORDER BY dt.requested_date DESC, dt.id DESC
    `)
    .all(...params);
  res.json({ success: true, data: rows });
});

router.get('/diagnostic-tests/:id', requireAuth, (req, res) => {
  const row = db
    .prepare(`
      SELECT dt.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
      FROM diagnostic_tests dt
      JOIN patients p ON dt.patient_id = p.id
      JOIN users u ON dt.doctor_id = u.id
      WHERE dt.id = ?
    `)
    .get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ success: false, message: 'Diagnostic test not found.' });
    return;
  }
  res.json({ success: true, data: row });
});

router.post('/diagnostic-tests', requireAuth, requireRole('DOCTOR', 'ADMIN'), (req: AuthenticatedRequest, res) => {
  const { patientId, appointmentId, testName, testCategory, priority, testCharge, reportNotes } = req.body ?? {};
  if (!patientId || !testName || !testCategory) {
    res.status(400).json({ success: false, message: 'patientId, testName, and testCategory are required.' });
    return;
  }

  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(patientId));
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found.' });
    return;
  }

  const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM diagnostic_tests').get() as { m: number }).m;
  const testCode = `TST-2026-${String(maxId + 1).padStart(4, '0')}`;
  const today = new Date().toISOString().slice(0, 10);

  const info = db
    .prepare(`
      INSERT INTO diagnostic_tests (test_code, patient_id, doctor_id, appointment_id, test_name, test_category, priority, requested_date, status, report_notes, test_charge)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?)
    `)
    .run(
      testCode,
      Number(patientId),
      req.user!.id,
      appointmentId ? Number(appointmentId) : null,
      String(testName).trim(),
      String(testCategory).trim(),
      priority ? String(priority).trim().toUpperCase() : 'ROUTINE',
      today,
      reportNotes ? String(reportNotes).trim() : null,
      Number(testCharge ?? 650)
    );

  const created = db
    .prepare(`
      SELECT dt.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
      FROM diagnostic_tests dt
      JOIN patients p ON dt.patient_id = p.id
      JOIN users u ON dt.doctor_id = u.id
      WHERE dt.id = ?
    `)
    .get(info.lastInsertRowid);

  res.status(201).json({ success: true, message: 'Diagnostic test requested.', data: created });
});

router.put('/diagnostic-tests/:id/report', requireAuth, requireRole('DOCTOR', 'ADMIN', 'PHARMACIST'), (req, res) => {
  const id = Number(req.params.id);
  const { status, resultSummary, reportNotes } = req.body ?? {};
  const existing = db.prepare('SELECT id FROM diagnostic_tests WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Diagnostic test not found.' });
    return;
  }

  const nextStatus = status ? String(status).trim().toUpperCase() : 'COMPLETED';
  db.prepare(`
    UPDATE diagnostic_tests SET
      status = ?,
      result_summary = COALESCE(?, result_summary),
      report_notes = COALESCE(?, report_notes),
      reported_at = CASE WHEN ? = 'COMPLETED' THEN datetime('now') ELSE reported_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextStatus,
    resultSummary ? String(resultSummary).trim() : null,
    reportNotes !== undefined ? String(reportNotes).trim() : null,
    nextStatus,
    id
  );

  const updated = db
    .prepare(`
      SELECT dt.*, p.patient_code, p.full_name as patient_name, u.full_name as doctor_name
      FROM diagnostic_tests dt
      JOIN patients p ON dt.patient_id = p.id
      JOIN users u ON dt.doctor_id = u.id
      WHERE dt.id = ?
    `)
    .get(id);

  res.json({ success: true, message: 'Diagnostic report updated.', data: updated });
});

export default router;
