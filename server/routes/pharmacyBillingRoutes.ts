import { Router } from 'express';
import db from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';

const router = Router();

function getTodayAndThirtyDays() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const plus30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { todayStr, plus30 };
}

// ==================== SHARED LOOKUPS ====================

router.get('/departments', requireAuth, (_req, res) => {
  const rows = db.prepare("SELECT * FROM departments WHERE status = 'ACTIVE' ORDER BY name").all();
  res.json({ success: true, data: rows });
});

router.get('/doctors', requireAuth, (req, res) => {
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const where = ["r.name = 'DOCTOR'", "u.status = 'ACTIVE'"];
  const params: number[] = [];
  if (departmentId) {
    where.push('u.department_id = ?');
    params.push(departmentId);
  }
  const rows = db
    .prepare(`
      SELECT u.id, u.staff_code, u.full_name, u.email, u.phone, u.specialization,
             u.qualification, u.consultation_fee, u.department_id, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE ${where.join(' AND ')}
      ORDER BY u.full_name
    `)
    .all(...params);
  res.json({ success: true, data: rows });
});

// ==================== PHARMACIST DASHBOARD ====================

router.get('/pharmacist/dashboard', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (_req, res) => {
  const { todayStr, plus30 } = getTodayAndThirtyDays();

  const totalMedicines = (db.prepare('SELECT COUNT(*) as c FROM medicines').get() as { c: number }).c;
  const totalUnitsInStock = (
    db.prepare('SELECT COALESCE(SUM(available_quantity), 0) as total FROM medicines').get() as { total: number }
  ).total;
  const lowStockCount = (
    db.prepare('SELECT COUNT(*) as c FROM medicines WHERE available_quantity <= reorder_level').get() as { c: number }
  ).c;
  const expiredCount = (
    db.prepare('SELECT COUNT(*) as c FROM medicines WHERE expiry_date < ?').get(todayStr) as { c: number }
  ).c;
  const nearExpiryCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM medicines WHERE expiry_date >= ? AND expiry_date <= ?')
      .get(todayStr, plus30) as { c: number }
  ).c;
  const pendingPrescriptions = (
    db.prepare("SELECT COUNT(*) as c FROM prescriptions WHERE status = 'PENDING'").get() as { c: number }
  ).c;
  const pendingBillsCount = (
    db.prepare("SELECT COUNT(*) as c FROM billing WHERE payment_status IN ('PENDING', 'PARTIAL')").get() as { c: number }
  ).c;
  const totalRevenueCollected = (
    db.prepare('SELECT COALESCE(SUM(paid_amount), 0) as total FROM billing').get() as { total: number }
  ).total;

  res.json({
    success: true,
    data: {
      stats: {
        totalMedicines,
        totalUnitsInStock,
        lowStockCount,
        expiredCount,
        nearExpiryCount,
        pendingPrescriptions,
        pendingBillsCount,
        totalRevenueCollected,
      },
    },
  });
});

// ==================== MEDICINE INVENTORY ====================

router.get('/medicines', requireAuth, (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  const { todayStr, plus30 } = getTodayAndThirtyDays();

  const where: string[] = [];
  const params: string[] = [];
  if (search) {
    where.push('(LOWER(medicine_name) LIKE LOWER(?) OR UPPER(medicine_code) LIKE UPPER(?) OR UPPER(batch_number) LIKE UPPER(?) OR LOWER(supplier) LIKE LOWER(?))');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM medicines ${whereSql} ORDER BY medicine_name ASC`)
    .all(...params) as Array<Record<string, any>>;

  const enriched = rows.map((m) => ({
    ...m,
    isLowStock: Number(m.available_quantity) <= Number(m.reorder_level),
    isExpired: String(m.expiry_date) < todayStr,
    isNearExpiry: String(m.expiry_date) >= todayStr && String(m.expiry_date) <= plus30,
  }));

  res.json({ success: true, data: enriched });
});

router.get('/medicines/low-stock', requireAuth, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM medicines WHERE available_quantity <= reorder_level ORDER BY available_quantity ASC')
    .all();
  res.json({ success: true, data: rows });
});

router.get('/medicines/expired', requireAuth, (_req, res) => {
  const { todayStr } = getTodayAndThirtyDays();
  const rows = db.prepare('SELECT * FROM medicines WHERE expiry_date < ? ORDER BY expiry_date ASC').all(todayStr);
  res.json({ success: true, data: rows });
});

router.get('/medicines/near-expiry', requireAuth, (_req, res) => {
  const { todayStr, plus30 } = getTodayAndThirtyDays();
  const rows = db
    .prepare('SELECT * FROM medicines WHERE expiry_date >= ? AND expiry_date <= ? ORDER BY expiry_date ASC')
    .all(todayStr, plus30);
  res.json({ success: true, data: rows });
});

router.post('/medicines', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (req, res) => {
  const { medicineName, batchNumber, category, availableQuantity, reorderLevel, unitPrice, expiryDate, supplier, description } =
    req.body ?? {};
  if (!medicineName || !batchNumber || !category || unitPrice === undefined || !expiryDate || !supplier) {
    res.status(400).json({
      success: false,
      message: 'medicineName, batchNumber, category, unitPrice, expiryDate, and supplier are required.',
    });
    return;
  }

  const dupBatch = db
    .prepare('SELECT id FROM medicines WHERE UPPER(batch_number) = UPPER(?)')
    .get(String(batchNumber).trim());
  if (dupBatch) {
    res.status(409).json({ success: false, message: 'A medicine with this batch number already exists.' });
    return;
  }

  const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM medicines').get() as { m: number }).m;
  const medicineCode = `MED-${String(maxId + 1).padStart(4, '0')}`;

  const info = db
    .prepare(`
      INSERT INTO medicines (medicine_code, medicine_name, batch_number, category, available_quantity, reorder_level, unit_price, expiry_date, supplier, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      medicineCode,
      String(medicineName).trim(),
      String(batchNumber).trim().toUpperCase(),
      String(category).trim(),
      Math.max(0, Number(availableQuantity ?? 0)),
      Math.max(1, Number(reorderLevel ?? 25)),
      Math.max(0, Number(unitPrice)),
      String(expiryDate).slice(0, 10),
      String(supplier).trim(),
      description ? String(description).trim() : null
    );

  const created = db.prepare('SELECT * FROM medicines WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Medicine added to inventory.', data: created });
});

router.put('/medicines/:id', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM medicines WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Medicine not found.' });
    return;
  }

  const { medicineName, batchNumber, category, availableQuantity, reorderLevel, unitPrice, expiryDate, supplier, description } =
    req.body ?? {};

  if (batchNumber) {
    const dup = db
      .prepare('SELECT id FROM medicines WHERE UPPER(batch_number) = UPPER(?) AND id != ?')
      .get(String(batchNumber).trim(), id);
    if (dup) {
      res.status(409).json({ success: false, message: 'Another medicine record already uses this batch number.' });
      return;
    }
  }

  db.prepare(`
    UPDATE medicines SET
      medicine_name = COALESCE(?, medicine_name),
      batch_number = COALESCE(?, batch_number),
      category = COALESCE(?, category),
      available_quantity = COALESCE(?, available_quantity),
      reorder_level = COALESCE(?, reorder_level),
      unit_price = COALESCE(?, unit_price),
      expiry_date = COALESCE(?, expiry_date),
      supplier = COALESCE(?, supplier),
      description = COALESCE(?, description),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    medicineName ? String(medicineName).trim() : null,
    batchNumber ? String(batchNumber).trim().toUpperCase() : null,
    category ? String(category).trim() : null,
    availableQuantity !== undefined ? Math.max(0, Number(availableQuantity)) : null,
    reorderLevel !== undefined ? Math.max(1, Number(reorderLevel)) : null,
    unitPrice !== undefined ? Math.max(0, Number(unitPrice)) : null,
    expiryDate ? String(expiryDate).slice(0, 10) : null,
    supplier ? String(supplier).trim() : null,
    description !== undefined ? String(description).trim() : null,
    id
  );

  const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
  res.json({ success: true, message: 'Medicine updated.', data: updated });
});

router.put('/medicines/:id/stock', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const { adjustment, absoluteQuantity } = req.body ?? {};
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id) as { id: number; available_quantity: number } | undefined;
  if (!existing) {
    res.status(404).json({ success: false, message: 'Medicine not found.' });
    return;
  }

  let nextQty: number;
  if (absoluteQuantity !== undefined) {
    nextQty = Math.max(0, Number(absoluteQuantity));
  } else if (adjustment !== undefined) {
    nextQty = Math.max(0, existing.available_quantity + Number(adjustment));
  } else {
    res.status(400).json({ success: false, message: 'Provide adjustment or absoluteQuantity.' });
    return;
  }

  db.prepare("UPDATE medicines SET available_quantity = ?, updated_at = datetime('now') WHERE id = ?").run(nextQty, id);
  const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
  res.json({ success: true, message: 'Stock quantity updated.', data: updated });
});

router.delete('/medicines/:id', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const referenced = db.prepare('SELECT COUNT(*) as c FROM prescription_items WHERE medicine_id = ?').get(id) as { c: number };
  if (referenced.c > 0) {
    res.status(409).json({
      success: false,
      message: 'Cannot delete medicine referenced by existing prescriptions. Set stock to 0 instead.',
    });
    return;
  }
  const result = db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ success: false, message: 'Medicine not found.' });
    return;
  }
  res.json({ success: true, message: 'Medicine deleted from inventory.' });
});

// ==================== BILLING MODULE (PROCESS 0.5) ====================

router.get('/billing', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const patientId = req.query.patientId ? Number(req.query.patientId) : null;
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (status) {
    where.push('b.payment_status = ?');
    params.push(status.toUpperCase());
  }
  if (patientId) {
    where.push('b.patient_id = ?');
    params.push(patientId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT b.*, p.patient_code, p.full_name as patient_name, p.mobile_number as patient_mobile,
             u.full_name as billed_by_name,
             a.appointment_code, pr.prescription_code
      FROM billing b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN users u ON b.billed_by = u.id
      LEFT JOIN appointments a ON b.appointment_id = a.id
      LEFT JOIN prescriptions pr ON b.prescription_id = pr.id
      ${whereSql}
      ORDER BY b.billed_at DESC, b.id DESC
    `)
    .all(...params);

  res.json({ success: true, data: rows });
});

router.get('/billing/:id', requireAuth, (req, res) => {
  const row = db
    .prepare(`
      SELECT b.*, p.patient_code, p.full_name as patient_name, u.full_name as billed_by_name
      FROM billing b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN users u ON b.billed_by = u.id
      WHERE b.id = ?
    `)
    .get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ success: false, message: 'Billing record not found.' });
    return;
  }
  res.json({ success: true, data: row });
});

router.post('/billing', requireAuth, requireRole('PHARMACIST', 'ADMIN', 'REGISTRATION_STAFF'), (req: AuthenticatedRequest, res) => {
  const {
    patientId,
    appointmentId,
    prescriptionId,
    consultationCharges,
    medicineCharges,
    diagnosticCharges,
    paidAmount,
    paymentMethod,
    notes,
  } = req.body ?? {};

  if (!patientId) {
    res.status(400).json({ success: false, message: 'patientId is required.' });
    return;
  }

  try {
    const created = db.transaction(() => {
      const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(patientId));
      if (!patient) {
        throw { status: 404, message: 'Patient not found.' };
      }

      if (prescriptionId) {
        const dupRxBill = db.prepare('SELECT bill_code FROM billing WHERE prescription_id = ?').get(Number(prescriptionId)) as
          | { bill_code: string }
          | undefined;
        if (dupRxBill) {
          throw {
            status: 409,
            message: `Duplicate billing prevented: Prescription already billed under invoice ${dupRxBill.bill_code}.`,
          };
        }
      }

      // Auto-calculate from linked records if explicit charges are omitted
      let consult = consultationCharges !== undefined ? Number(consultationCharges) : 0;
      if (consultationCharges === undefined && appointmentId) {
        const apptFee = db
          .prepare('SELECT u.consultation_fee FROM appointments a JOIN users u ON a.doctor_id = u.id WHERE a.id = ?')
          .get(Number(appointmentId)) as { consultation_fee: number } | undefined;
        consult = apptFee?.consultation_fee ?? 0;
      }

      let medCharge = medicineCharges !== undefined ? Number(medicineCharges) : 0;
      if (medicineCharges === undefined && prescriptionId) {
        const rxCost = db
          .prepare(`
            SELECT COALESCE(SUM(pi.quantity_prescribed * m.unit_price), 0) as total
            FROM prescription_items pi
            JOIN medicines m ON pi.medicine_id = m.id
            WHERE pi.prescription_id = ?
          `)
          .get(Number(prescriptionId)) as { total: number };
        medCharge = Math.round(rxCost.total * 100) / 100;
      }

      let diagCharge = diagnosticCharges !== undefined ? Number(diagnosticCharges) : 0;
      if (diagnosticCharges === undefined && appointmentId) {
        const testCost = db
          .prepare('SELECT COALESCE(SUM(test_charge), 0) as total FROM diagnostic_tests WHERE appointment_id = ?')
          .get(Number(appointmentId)) as { total: number };
        diagCharge = testCost.total;
      }

      const totalAmount = Math.round((consult + medCharge + diagCharge) * 100) / 100;
      if (totalAmount <= 0) {
        throw { status: 400, message: 'Total bill amount must be greater than zero.' };
      }

      const paid = Math.min(totalAmount, Math.max(0, Number(paidAmount ?? 0)));
      const paymentStatus = paid >= totalAmount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';

      const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM billing').get() as { m: number }).m;
      const billCode = `INV-2026-${String(maxId + 1).padStart(4, '0')}`;

      const info = db
        .prepare(`
          INSERT INTO billing (
            bill_code, patient_id, appointment_id, prescription_id,
            consultation_charges, medicine_charges, diagnostic_charges,
            total_amount, paid_amount, payment_status, payment_method, billed_by, billed_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `)
        .run(
          billCode,
          Number(patientId),
          appointmentId ? Number(appointmentId) : null,
          prescriptionId ? Number(prescriptionId) : null,
          consult,
          medCharge,
          diagCharge,
          totalAmount,
          paid,
          paymentStatus,
          paymentMethod ? String(paymentMethod).trim().toUpperCase() : null,
          req.user!.id,
          notes ? String(notes).trim() : null
        );

      return db
        .prepare(`
          SELECT b.*, p.patient_code, p.full_name as patient_name, u.full_name as billed_by_name
          FROM billing b
          JOIN patients p ON b.patient_id = p.id
          LEFT JOIN users u ON b.billed_by = u.id
          WHERE b.id = ?
        `)
        .get(info.lastInsertRowid);
    })();

    res.status(201).json({ success: true, message: 'Invoice generated successfully.', data: created });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to generate bill.' });
  }
});

router.put('/billing/:id/payment-status', requireAuth, requireRole('PHARMACIST', 'ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM billing WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!existing) {
    res.status(404).json({ success: false, message: 'Billing record not found.' });
    return;
  }

  const { paidAmount, paymentStatus, paymentMethod, notes } = req.body ?? {};
  const total = Number(existing.total_amount);
  let nextPaid = paidAmount !== undefined ? Math.min(total, Math.max(0, Number(paidAmount))) : Number(existing.paid_amount);
  let nextStatus = paymentStatus ? String(paymentStatus).trim().toUpperCase() : existing.payment_status;

  if (nextStatus === 'PAID' && paidAmount === undefined) {
    nextPaid = total;
  } else if (paidAmount !== undefined && !paymentStatus) {
    nextStatus = nextPaid >= total ? 'PAID' : nextPaid > 0 ? 'PARTIAL' : 'PENDING';
  }

  db.prepare(`
    UPDATE billing SET
      paid_amount = ?,
      payment_status = ?,
      payment_method = COALESCE(?, payment_method),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextPaid,
    nextStatus,
    paymentMethod ? String(paymentMethod).trim().toUpperCase() : null,
    notes !== undefined ? String(notes).trim() : null,
    id
  );

  const updated = db
    .prepare(`
      SELECT b.*, p.patient_code, p.full_name as patient_name, u.full_name as billed_by_name
      FROM billing b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN users u ON b.billed_by = u.id
      WHERE b.id = ?
    `)
    .get(id);

  res.json({ success: true, message: 'Payment status updated.', data: updated });
});

export default router;
