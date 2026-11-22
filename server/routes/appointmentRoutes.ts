import { Router } from 'express';
import db from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';

const router = Router();

const DAYS_OF_WEEK = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function generateSlotsForWindow(startTime: string, endTime: string, durationMinutes: number): string[] {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const slots: string[] = [];
  for (let t = startTotal; t + durationMinutes <= endTotal; t += durationMinutes) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

// PROCESS 0.2.4 - CHECK DOCTOR AVAILABILITY
router.get('/availability', requireAuth, (req, res) => {
  const dateStr = String(req.query.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;

  const parsedDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    res.status(400).json({ success: false, message: 'Invalid date parameter.' });
    return;
  }
  const dayOfWeek = DAYS_OF_WEEK[parsedDate.getDay()];

  const where: string[] = ["r.name = 'DOCTOR'", "u.status = 'ACTIVE'"];
  const params: Array<number | string> = [];
  if (departmentId) {
    where.push('u.department_id = ?');
    params.push(departmentId);
  }
  if (doctorId) {
    where.push('u.id = ?');
    params.push(doctorId);
  }

  const doctors = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.specialization, u.qualification,
             u.consultation_fee, u.department_id, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE ${where.join(' AND ')}
      ORDER BY u.full_name
    `)
    .all(...params) as Array<Record<string, any>>;

  const getSchedule = db.prepare(`
    SELECT * FROM staff_schedules
    WHERE staff_id = ? AND day_of_week = ? AND is_available = 1
    LIMIT 1
  `);

  const getBookedSlots = db.prepare(`
    SELECT time_slot FROM appointments
    WHERE doctor_id = ? AND appointment_date = ? AND status != 'CANCELLED'
  `);

  const result = doctors.map((doc) => {
    const sched = getSchedule.get(doc.id, dayOfWeek) as
      | { start_time: string; end_time: string; slot_duration_minutes: number; room_number: string; max_patients: number }
      | undefined;

    if (!sched) {
      return {
        ...doc,
        date: dateStr,
        dayOfWeek,
        isAvailable: false,
        roomNumber: null,
        availableSlots: [],
        bookedSlots: [],
      };
    }

    const allSlots = generateSlotsForWindow(sched.start_time, sched.end_time, sched.slot_duration_minutes);
    const bookedRows = getBookedSlots.all(doc.id, dateStr) as Array<{ time_slot: string }>;
    const bookedSet = new Set(bookedRows.map((b) => b.time_slot));
    const availableSlots = allSlots.filter((s) => !bookedSet.has(s));

    return {
      ...doc,
      date: dateStr,
      dayOfWeek,
      isAvailable: availableSlots.length > 0,
      shiftWindow: `${sched.start_time} - ${sched.end_time}`,
      roomNumber: sched.room_number,
      availableSlots,
      bookedSlots: Array.from(bookedSet),
    };
  });

  res.json({ success: true, data: result });
});

// PROCESS 0.3 - LIST APPOINTMENTS
router.get('/', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;
  const patientId = req.query.patientId ? Number(req.query.patientId) : null;
  const date = String(req.query.date ?? '').trim();

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  if (doctorId) {
    where.push('a.doctor_id = ?');
    params.push(doctorId);
  }
  if (patientId) {
    where.push('a.patient_id = ?');
    params.push(patientId);
  }
  if (date) {
    where.push('a.appointment_date = ?');
    params.push(date);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT a.*, p.patient_code, p.full_name as patient_name, p.mobile_number as patient_mobile,
             u.full_name as doctor_name, u.consultation_fee, d.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON a.department_id = d.id
      ${whereSql}
      ORDER BY a.appointment_date DESC, a.time_slot ASC
    `)
    .all(...params);

  res.json({ success: true, data: rows });
});

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(`
      SELECT a.*, p.patient_code, p.full_name as patient_name,
             u.full_name as doctor_name, d.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.id = ?
    `)
    .get(id);
  if (!row) {
    res.status(404).json({ success: false, message: 'Appointment not found.' });
    return;
  }
  res.json({ success: true, data: row });
});

// SCHEDULE APPOINTMENT (with transactional double-booking prevention)
router.post('/', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req: AuthenticatedRequest, res) => {
  const { patientId, doctorId, departmentId, appointmentDate, timeSlot, visitType, reason, notes } = req.body ?? {};
  if (!patientId || !doctorId || !departmentId || !appointmentDate || !timeSlot) {
    res.status(400).json({
      success: false,
      message: 'patientId, doctorId, departmentId, appointmentDate, and timeSlot are required.',
    });
    return;
  }

  const dateOnly = String(appointmentDate).slice(0, 10);
  const slotStr = String(timeSlot).trim();

  try {
    const created = db.transaction(() => {
      const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(patientId));
      if (!patient) {
        throw { status: 404, message: 'Selected patient does not exist.' };
      }

      const doctor = db
        .prepare("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND r.name = 'DOCTOR' AND u.status = 'ACTIVE'")
        .get(Number(doctorId));
      if (!doctor) {
        throw { status: 404, message: 'Selected doctor is not active.' };
      }

      const conflict = db
        .prepare("SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'CANCELLED'")
        .get(Number(doctorId), dateOnly, slotStr);
      if (conflict) {
        throw { status: 409, message: `Double-booking prevented: Doctor already has an appointment at ${slotStr} on ${dateOnly}.` };
      }

      const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM appointments').get() as { m: number }).m;
      const appointmentCode = `APT-2026-${String(maxId + 1).padStart(4, '0')}`;

      const info = db
        .prepare(`
          INSERT INTO appointments (appointment_code, patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, reason, status, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)
        `)
        .run(
          appointmentCode,
          Number(patientId),
          Number(doctorId),
          Number(departmentId),
          dateOnly,
          slotStr,
          visitType ? String(visitType).trim() : 'Consultation',
          reason ? String(reason).trim() : null,
          notes ? String(notes).trim() : null,
          req.user!.id
        );

      return db
        .prepare(`
          SELECT a.*, p.patient_code, p.full_name as patient_name,
                 u.full_name as doctor_name, d.name as department_name
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          JOIN users u ON a.doctor_id = u.id
          JOIN departments d ON a.department_id = d.id
          WHERE a.id = ?
        `)
        .get(info.lastInsertRowid);
    })();

    res.status(201).json({ success: true, message: 'Appointment scheduled successfully.', data: created });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to schedule appointment.' });
  }
});

// UPDATE APPOINTMENT
router.put('/:id', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF', 'DOCTOR'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!existing) {
    res.status(404).json({ success: false, message: 'Appointment not found.' });
    return;
  }

  const { doctorId, departmentId, appointmentDate, timeSlot, visitType, reason, status, notes } = req.body ?? {};
  const nextDoctorId = doctorId ? Number(doctorId) : existing.doctor_id;
  const nextDate = appointmentDate ? String(appointmentDate).slice(0, 10) : existing.appointment_date;
  const nextSlot = timeSlot ? String(timeSlot).trim() : existing.time_slot;
  const nextStatus = status ? String(status).trim().toUpperCase() : existing.status;

  if (nextStatus !== 'CANCELLED') {
    const conflict = db
      .prepare("SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'CANCELLED' AND id != ?")
      .get(nextDoctorId, nextDate, nextSlot, id);
    if (conflict) {
      res.status(409).json({
        success: false,
        message: `Slot ${nextSlot} on ${nextDate} is already booked for this doctor.`,
      });
      return;
    }
  }

  db.prepare(`
    UPDATE appointments SET
      doctor_id = ?,
      department_id = ?,
      appointment_date = ?,
      time_slot = ?,
      visit_type = COALESCE(?, visit_type),
      reason = COALESCE(?, reason),
      status = ?,
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextDoctorId,
    departmentId ? Number(departmentId) : existing.department_id,
    nextDate,
    nextSlot,
    visitType ? String(visitType).trim() : null,
    reason !== undefined ? String(reason).trim() : null,
    nextStatus,
    notes !== undefined ? String(notes).trim() : null,
    id
  );

  const updated = db
    .prepare(`
      SELECT a.*, p.patient_code, p.full_name as patient_name,
             u.full_name as doctor_name, d.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.id = ?
    `)
    .get(id);

  res.json({ success: true, message: 'Appointment updated.', data: updated });
});

// DELETE / CANCEL APPOINTMENT
router.delete('/:id', requireAuth, requireRole('ADMIN', 'REGISTRATION_STAFF'), (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ success: false, message: 'Appointment not found.' });
    return;
  }
  res.json({ success: true, message: 'Appointment deleted.' });
});

export default router;
