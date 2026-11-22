import bcrypt from 'bcryptjs';
import db from './db.ts';

export function seedDatabase(): void {
  const roleCount = (db.prepare('SELECT COUNT(*) as cnt FROM roles').get() as { cnt: number }).cnt;
  if (roleCount > 0) {
    // Ensure existing database instances reflect updated staff names & emails
    const syncSeedUsers = db.transaction(() => {
      db.prepare(`UPDATE departments SET head_doctor_name = 'Dr. Nisha Kumari' WHERE department_code = 'DEPT-01' AND head_doctor_name IN ('Dr. Arvind Sharma', 'Dr. Neha Kumari')`).run();
      db.prepare(`UPDATE users SET full_name = 'Neha Kumari', email = 'admin@hmis.edu' WHERE staff_code = 'STF-ADM-001'`).run();
      db.prepare(`UPDATE users SET full_name = 'Manish Sharma', email = 'reg1@hmis.edu' WHERE staff_code = 'STF-REG-001'`).run();
      db.prepare(`UPDATE users SET email = 'reg2@hmis.edu' WHERE staff_code = 'STF-REG-002' AND email LIKE '%meridianhmis.edu'`).run();
      db.prepare(`UPDATE users SET full_name = 'Dr. Nisha Kumari', email = 'dr.nisha@hmis.edu' WHERE staff_code = 'STF-DOC-001'`).run();
      db.prepare(`UPDATE users SET email = 'dr.patel@hmis.edu' WHERE staff_code = 'STF-DOC-002' AND email LIKE '%meridianhmis.edu'`).run();
      db.prepare(`UPDATE users SET email = 'dr.nair@hmis.edu' WHERE staff_code = 'STF-DOC-003' AND email LIKE '%meridianhmis.edu'`).run();
      db.prepare(`UPDATE users SET email = 'dr.verma@hmis.edu' WHERE staff_code = 'STF-DOC-004' AND email LIKE '%meridianhmis.edu'`).run();
      db.prepare(`UPDATE users SET email = 'dr.iyer@hmis.edu' WHERE staff_code = 'STF-DOC-005' AND email LIKE '%meridianhmis.edu'`).run();
      db.prepare(`UPDATE users SET full_name = 'Atit Kumar', email = 'pharma1@hmis.edu' WHERE staff_code = 'STF-PHM-001'`).run();
      db.prepare(`UPDATE users SET email = 'pharma2@hmis.edu' WHERE staff_code = 'STF-PHM-002' AND email LIKE '%meridianhmis.edu'`).run();
    });
    syncSeedUsers();
    seedInitialVisits();
    return;
  }

  const runSeed = db.transaction(() => {
    // 1. Roles
    const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    const adminRoleId = insertRole.run('ADMIN', 'System Administrator with full hospital governance, staff, department, schedule, and billing oversight').lastInsertRowid;
    const regRoleId = insertRole.run('REGISTRATION_STAFF', 'Front-desk Registration Staff managing patient intake, demographics, doctor availability, and appointments').lastInsertRowid;
    const doctorRoleId = insertRole.run('DOCTOR', 'Attending Physician managing clinical diagnosis, treatment progress, prescriptions, and diagnostic orders').lastInsertRowid;
    const pharmaRoleId = insertRole.run('PHARMACIST', 'Clinical Pharmacist managing medicine inventory, expiry alerts, prescription verification, and billing').lastInsertRowid;

    // 2. Permissions
    const insertPerm = db.prepare('INSERT INTO permissions (code, name, module, description) VALUES (?, ?, ?, ?)');
    const permissionsData = [
      ['STAFF_MANAGE', 'Manage Staff Accounts', 'ADMIN', 'Create, update, and deactivate hospital staff'],
      ['DEPT_MANAGE', 'Manage Departments', 'ADMIN', 'Configure clinical departments and heads'],
      ['ROLE_MANAGE', 'Manage Roles & Permissions', 'ADMIN', 'Assign granular access permissions to roles'],
      ['SCHEDULE_MANAGE', 'Manage Staff Schedules', 'ADMIN', 'Create and adjust weekly clinical rosters'],
      ['BILLING_OVERVIEW', 'View Billing Analytics', 'ADMIN', 'Inspect hospital-wide financial ledger'],
      ['PATIENT_REGISTER', 'Register Patients', 'REGISTRATION', 'Create new patient profiles and HMIS-PAT IDs'],
      ['PATIENT_UPDATE', 'Update Patient Records', 'REGISTRATION', 'Edit demographics, address, and contact details'],
      ['PATIENT_VIEW', 'View Patient Records', 'CLINICAL', 'Search and view patient profiles and history'],
      ['APPOINTMENT_MANAGE', 'Manage Appointments', 'REGISTRATION', 'Schedule, reschedule, and cancel appointments'],
      ['AVAILABILITY_CHECK', 'Check Doctor Availability', 'REGISTRATION', 'Inspect doctor schedules and open slots'],
      ['DIAGNOSIS_WRITE', 'Add Diagnosis & Treatment', 'DOCTOR', 'Record clinical diagnoses, vitals, and progress'],
      ['PRESCRIPTION_CREATE', 'Create Prescriptions', 'DOCTOR', 'Issue digital prescriptions linked to Patient ID'],
      ['DIAGNOSTIC_ORDER', 'Order & View Diagnostics', 'DOCTOR', 'Request lab/imaging tests and review reports'],
      ['MEDICINE_MANAGE', 'Manage Medicine Inventory', 'PHARMACY', 'Add, edit, and replenish medicine stock'],
      ['PRESCRIPTION_VERIFY', 'Verify & Dispense Prescriptions', 'PHARMACY', 'Verify prescriptions and deduct inventory'],
      ['BILLING_MANAGE', 'Generate Bills & Record Payments', 'PHARMACY', 'Compute charges and update payment status'],
    ];

    const permMap: Record<string, number | bigint> = {};
    for (const [code, name, mod, desc] of permissionsData) {
      permMap[code] = insertPerm.run(code, name, mod, desc).lastInsertRowid;
    }

    const insertRP = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    // Admin gets all
    for (const pid of Object.values(permMap)) {
      insertRP.run(adminRoleId, pid);
    }
    // Registration Staff
    for (const code of ['PATIENT_REGISTER', 'PATIENT_UPDATE', 'PATIENT_VIEW', 'APPOINTMENT_MANAGE', 'AVAILABILITY_CHECK']) {
      insertRP.run(regRoleId, permMap[code]);
    }
    // Doctor
    for (const code of ['PATIENT_VIEW', 'AVAILABILITY_CHECK', 'DIAGNOSIS_WRITE', 'PRESCRIPTION_CREATE', 'DIAGNOSTIC_ORDER']) {
      insertRP.run(doctorRoleId, permMap[code]);
    }
    // Pharmacist
    for (const code of ['PATIENT_VIEW', 'MEDICINE_MANAGE', 'PRESCRIPTION_VERIFY', 'BILLING_MANAGE']) {
      insertRP.run(pharmaRoleId, permMap[code]);
    }

    // 3. Departments (5)
    const insertDept = db.prepare(
      'INSERT INTO departments (department_code, name, head_doctor_name, location, phone_ext, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const deptCardio = insertDept.run('DEPT-01', 'Cardiology', 'Dr. Nisha Kumari', 'Block A · Floor 2', '2101', 'Interventional cardiology, ECG, echocardiography, and cardiac care', 'ACTIVE').lastInsertRowid;
    const deptGenMed = insertDept.run('DEPT-02', 'General Medicine', 'Dr. Priya Patel', 'Block A · Floor 1', '2102', 'Internal medicine, primary outpatient care, and chronic disease management', 'ACTIVE').lastInsertRowid;
    const deptOrtho = insertDept.run('DEPT-03', 'Orthopedics', 'Dr. Vikram Nair', 'Block B · Floor 2', '2201', 'Musculoskeletal surgery, trauma care, and joint rehabilitation', 'ACTIVE').lastInsertRowid;
    const deptPeds = insertDept.run('DEPT-04', 'Pediatrics', 'Dr. Sneha Verma', 'Block C · Floor 1', '2301', 'Neonatal, infant, and adolescent clinical care and immunization', 'ACTIVE').lastInsertRowid;
    const deptPath = insertDept.run('DEPT-05', 'Pathology & Diagnostics', 'Dr. Rohan Iyer', 'Block B · Ground', '2401', 'Clinical biochemistry, hematology, microbiology, and diagnostic imaging', 'ACTIVE').lastInsertRowid;

    // 4. Users (1 Admin, 2 Registration Staff, 5 Doctors, 2 Pharmacists = 10 staff)
    const hashAdmin = bcrypt.hashSync('Admin@123', 10);
    const hashReg = bcrypt.hashSync('Reg@123', 10);
    const hashDoc = bcrypt.hashSync('Doctor@123', 10);
    const hashPharma = bcrypt.hashSync('Pharma@123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (staff_code, full_name, email, password_hash, phone, specialization, qualification, consultation_fee, department_id, role_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const adminId = insertUser.run('STF-ADM-001', 'Neha Kumari', 'admin@hmis.edu', hashAdmin, '+91-9810010001', 'Hospital Administration', 'MBA Healthcare, MHA', 0, null, adminRoleId, 'ACTIVE').lastInsertRowid;
    const reg1Id = insertUser.run('STF-REG-001', 'Manish Sharma', 'reg1@hmis.edu', hashReg, '+91-9810010002', 'Front Desk Operations', 'B.Sc Health Info', 0, deptGenMed, regRoleId, 'ACTIVE').lastInsertRowid;
    insertUser.run('STF-REG-002', 'Karan Malhotra', 'reg2@hmis.edu', hashReg, '+91-9810010003', 'Patient Intake & OPD', 'BBA Healthcare', 0, deptCardio, regRoleId, 'ACTIVE');

    const doc1Id = insertUser.run('STF-DOC-001', 'Dr. Nisha Kumari', 'dr.nisha@hmis.edu', hashDoc, '+91-9810020001', 'Interventional Cardiology', 'MD, DM Cardiology', 900, deptCardio, doctorRoleId, 'ACTIVE').lastInsertRowid;
    const doc2Id = insertUser.run('STF-DOC-002', 'Dr. Priya Patel', 'dr.patel@hmis.edu', hashDoc, '+91-9810020002', 'Internal Medicine', 'MBBS, MD Medicine', 600, deptGenMed, doctorRoleId, 'ACTIVE').lastInsertRowid;
    const doc3Id = insertUser.run('STF-DOC-003', 'Dr. Vikram Nair', 'dr.nair@hmis.edu', hashDoc, '+91-9810020003', 'Orthopedic Surgery', 'MBBS, MS Ortho', 800, deptOrtho, doctorRoleId, 'ACTIVE').lastInsertRowid;
    const doc4Id = insertUser.run('STF-DOC-004', 'Dr. Sneha Verma', 'dr.verma@hmis.edu', hashDoc, '+91-9810020004', 'Pediatrics & Neonatology', 'MBBS, MD Pediatrics', 650, deptPeds, doctorRoleId, 'ACTIVE').lastInsertRowid;
    const doc5Id = insertUser.run('STF-DOC-005', 'Dr. Rohan Iyer', 'dr.iyer@hmis.edu', hashDoc, '+91-9810020005', 'Clinical Pathology', 'MBBS, MD Pathology', 550, deptPath, doctorRoleId, 'ACTIVE').lastInsertRowid;

    const pharma1Id = insertUser.run('STF-PHM-001', 'Atit Kumar', 'pharma1@hmis.edu', hashPharma, '+91-9810030001', 'Chief Clinical Pharmacist', 'M.Pharm', 0, null, pharmaRoleId, 'ACTIVE').lastInsertRowid;
    insertUser.run('STF-PHM-002', 'Siddharth Joshi', 'pharma2@hmis.edu', hashPharma, '+91-9810030002', 'Dispensing Pharmacist', 'B.Pharm', 0, null, pharmaRoleId, 'ACTIVE');

    // 5. Staff Schedules (covering every day of week for doctors so availability checks always return rich slots)
    const insertSchedule = db.prepare(`
      INSERT INTO staff_schedules (staff_id, department_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, room_number, is_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const docSchedules: Array<[number | bigint, number | bigint, string]> = [
      [doc1Id, deptCardio, 'OPD-201'],
      [doc2Id, deptGenMed, 'OPD-104'],
      [doc3Id, deptOrtho, 'OPD-208'],
      [doc4Id, deptPeds, 'OPD-112'],
      [doc5Id, deptPath, 'LAB-003'],
    ];
    for (const [docId, dId, room] of docSchedules) {
      for (const day of days) {
        const isSunday = day === 'SUNDAY';
        insertSchedule.run(docId, dId, day, '09:00', isSunday ? '13:00' : '16:00', 30, isSunday ? 8 : 14, room, isSunday && docId === doc3Id ? 0 : 1);
      }
    }
    insertSchedule.run(reg1Id, deptGenMed, 'MONDAY', '08:00', '16:00', 30, 40, 'DESK-01', 1);
    insertSchedule.run(pharma1Id, null, 'MONDAY', '08:30', '17:30', 30, 60, 'PHARM-01', 1);

    // 6. Patients (10)
    const insertPatient = db.prepare(`
      INSERT INTO patients (
        patient_code, full_name, dob, age, gender, blood_group, marital_status,
        mobile_number, alternate_phone, email,
        house_number, street_locality, city, state, country, pin_code,
        emergency_contact_name, emergency_relationship, emergency_contact_number,
        id_proof_type, id_proof_number, registration_date, registration_type,
        assigned_department_id, assigned_doctor_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const patientsSeed = [
      ['HMIS-PAT-0001', 'Aarav Mehta', '1982-04-14', 44, 'Male', 'O+', 'Married', '9820112233', '9820112200', 'aarav.mehta@example.com', 'B-402', 'Marine Drive', 'Mumbai', 'Maharashtra', 'India', '400002', 'Kavita Mehta', 'Spouse', '9820112299', 'Aadhaar', 'XXXX-4521-8812', '2026-11-02', 'OPD', deptCardio, doc1Id, reg1Id],
      ['HMIS-PAT-0002', 'Neha Kapoor', '1991-08-22', 35, 'Female', 'A+', 'Married', '9811223344', '', 'neha.kapoor@example.com', '14', 'Vasant Vihar', 'New Delhi', 'Delhi', 'India', '110057', 'Rakesh Kapoor', 'Spouse', '9811223399', 'PAN', 'ABCPK9123F', '2026-11-04', 'OPD', deptGenMed, doc2Id, reg1Id],
      ['HMIS-PAT-0003', 'Suresh Subramanian', '1965-12-03', 60, 'Male', 'B+', 'Married', '9840123456', '9840123400', 'suresh.s@example.com', '28', 'Adyar', 'Chennai', 'Tamil Nadu', 'India', '600020', 'Lakshmi S', 'Spouse', '9840123499', 'Aadhaar', 'XXXX-8890-1244', '2026-11-06', 'IPD', deptOrtho, doc3Id, reg1Id],
      ['HMIS-PAT-0004', 'Ishita Banerjee', '2018-06-19', 8, 'Female', 'AB+', 'Single', '9830044556', '', 'parent.banerjee@example.com', '7A', 'Salt Lake Sector II', 'Kolkata', 'West Bengal', 'India', '700091', 'Sourav Banerjee', 'Father', '9830044500', 'Birth Certificate', 'WB-BC-2018-994', '2026-11-08', 'OPD', deptPeds, doc4Id, reg1Id],
      ['HMIS-PAT-0005', 'Mohammed Farhan', '1978-01-29', 48, 'Male', 'O-', 'Married', '9849055667', '', 'm.farhan@example.com', '8-2-120', 'Banjara Hills', 'Hyderabad', 'Telangana', 'India', '500034', 'Zoya Farhan', 'Spouse', '9849055600', 'Passport', 'Z4491028', '2026-11-10', 'OPD', deptCardio, doc1Id, reg1Id],
      ['HMIS-PAT-0006', 'Divya Menon', '1996-11-05', 30, 'Female', 'B-', 'Single', '9845066778', '', 'divya.menon@example.com', '310', 'Indiranagar 100ft Rd', 'Bengaluru', 'Karnataka', 'India', '560038', 'Radha Menon', 'Mother', '9845066700', 'Driving License', 'KA03-201600491', '2026-11-12', 'OPD', deptGenMed, doc2Id, reg1Id],
      ['HMIS-PAT-0007', 'Harshvardhan Rao', '1958-03-11', 68, 'Male', 'A-', 'Widowed', '9823077889', '9823077800', 'h.rao@example.com', '55', 'Koregaon Park', 'Pune', 'Maharashtra', 'India', '411001', 'Nikhil Rao', 'Son', '9823077899', 'Aadhaar', 'XXXX-3319-7720', '2026-11-14', 'EMERGENCY', deptCardio, doc1Id, reg1Id],
      ['HMIS-PAT-0008', 'Rituja Kulkarni', '1988-09-17', 38, 'Female', 'O+', 'Married', '9822088990', '', 'rituja.k@example.com', '12', 'Shivaji Nagar', 'Pune', 'Maharashtra', 'India', '411005', 'Amey Kulkarni', 'Spouse', '9822088900', 'Aadhaar', 'XXXX-6671-2231', '2026-11-16', 'OPD', deptOrtho, doc3Id, reg1Id],
      ['HMIS-PAT-0009', 'Kabir Singhania', '2014-02-25', 12, 'Male', 'B+', 'Single', '9814099001', '', 'singhania.family@example.com', '99', 'Sector 17', 'Chandigarh', 'Chandigarh', 'India', '160017', 'Rohan Singhania', 'Father', '9814099099', 'Aadhaar', 'XXXX-1190-5501', '2026-11-18', 'OPD', deptPeds, doc4Id, reg1Id],
      ['HMIS-PAT-0010', 'Meenakshi Sundaram', '1973-07-08', 53, 'Female', 'A+', 'Married', '9842010112', '', 'meenakshi.s@example.com', '42', 'RS Puram', 'Coimbatore', 'Tamil Nadu', 'India', '641002', 'Sundaram V', 'Spouse', '9842010199', 'PAN', 'BGHPS4412L', '2026-11-20', 'OPD', deptPath, doc5Id, reg1Id],
    ];

    const patientIds: Array<number | bigint> = [];
    for (const row of patientsSeed) {
      patientIds.push(insertPatient.run(...row).lastInsertRowid);
    }

    // 7. Appointments (10)
    const insertAppt = db.prepare(`
      INSERT INTO appointments (appointment_code, patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, reason, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const apptsSeed = [
      ['APT-2026-0001', patientIds[0], doc1Id, deptCardio, '2026-11-22', '09:30', 'Consultation', 'Hypertension follow-up & ECG review', 'COMPLETED', 'BP stable on current regimen', reg1Id],
      ['APT-2026-0002', patientIds[1], doc2Id, deptGenMed, '2026-11-22', '10:00', 'Consultation', 'Persistent fever and fatigue for 4 days', 'COMPLETED', 'Labs ordered', reg1Id],
      ['APT-2026-0003', patientIds[2], doc3Id, deptOrtho, '2026-11-22', '10:30', 'Follow-up', 'Post-operative knee rehabilitation check', 'COMPLETED', 'Improving range of motion', reg1Id],
      ['APT-2026-0004', patientIds[3], doc4Id, deptPeds, '2026-11-22', '11:00', 'Consultation', 'Seasonal bronchitis and dry cough', 'COMPLETED', 'Nebulization advised', reg1Id],
      ['APT-2026-0005', patientIds[4], doc1Id, deptCardio, '2026-11-22', '11:30', 'Consultation', 'Exertional chest tightness evaluation', 'COMPLETED', 'Lipid panel + Troponin ordered', reg1Id],
      ['APT-2026-0006', patientIds[5], doc2Id, deptGenMed, '2026-11-22', '14:00', 'Consultation', 'Migraine episodes and Vitamin D screening', 'SCHEDULED', 'First consultation', reg1Id],
      ['APT-2026-0007', patientIds[6], doc1Id, deptCardio, '2026-11-23', '09:00', 'Follow-up', 'Atrial fibrillation rate control check', 'SCHEDULED', 'Bring Holter summary', reg1Id],
      ['APT-2026-0008', patientIds[7], doc3Id, deptOrtho, '2026-11-23', '10:00', 'Consultation', 'Lumbar radiculopathy pain evaluation', 'SCHEDULED', 'MRI review scheduled', reg1Id],
      ['APT-2026-0009', patientIds[8], doc4Id, deptPeds, '2026-11-23', '11:30', 'Vaccination', 'Tdap booster and annual pediatric review', 'SCHEDULED', 'Immunization card verified', reg1Id],
      ['APT-2026-0010', patientIds[9], doc5Id, deptPath, '2026-11-21', '15:00', 'Diagnostic Review', 'HbA1c and Thyroid panel interpretation', 'CANCELLED', 'Rescheduled by patient request', reg1Id],
    ];
    const apptIds: Array<number | bigint> = [];
    for (const row of apptsSeed) {
      apptIds.push(insertAppt.run(...row).lastInsertRowid);
    }

    // 8. Medical Records (10)
    const insertRec = db.prepare(`
      INSERT INTO medical_records (record_code, patient_id, doctor_id, appointment_id, visit_date, chief_complaint, diagnosis, treatment_plan, clinical_notes, progress_status, vitals_bp, vitals_temp, vitals_pulse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const recordsSeed = [
      ['MR-2026-0001', patientIds[0], doc1Id, apptIds[0], '2026-11-22', 'Elevated morning BP readings', 'Essential Hypertension (Stage 1)', 'Continue Telmisartan 40mg OD, low-sodium DASH diet, 30m daily walk', 'ECG sinus rhythm, no LVH strain', 'STABLE', '134/84', '98.2 F', '74 bpm'],
      ['MR-2026-0002', patientIds[1], doc2Id, apptIds[1], '2026-11-22', 'High-grade fever & malaise', 'Acute Viral Febrile Illness', 'Paracetamol 650mg SOS, hydration 3L/day, CBC & Dengue NS1 check', 'Monitor platelet trend over 48h', 'UNDER_OBSERVATION', '116/76', '101.4 F', '94 bpm'],
      ['MR-2026-0003', patientIds[2], doc3Id, apptIds[2], '2026-11-22', 'Right knee stiffness post-TKR', 'Post-Total Knee Replacement Recovery', 'Physiotherapy flexion exercises, Aceclofenac 100mg BD for 5 days', 'Surgical wound dry and healed cleanly', 'IMPROVING', '128/80', '98.4 F', '72 bpm'],
      ['MR-2026-0004', patientIds[3], doc4Id, apptIds[3], '2026-11-22', 'Wheezing and night cough', 'Acute Pediatric Bronchitis', 'Salbutamol nebulization + Azithromycin pediatric suspension for 3 days', 'Chest auscultation shows mild bilateral rhonchi', 'IMPROVING', '100/66', '99.1 F', '102 bpm'],
      ['MR-2026-0005', patientIds[4], doc1Id, apptIds[4], '2026-11-22', 'Chest discomfort on brisk walking', 'Suspected Stable Angina / Dyslipidemia', 'Atorvastatin 20mg HS, Aspirin 75mg OD, schedule Treadmill Stress Test', 'Troponin negative, lipid profile pending', 'UNDER_OBSERVATION', '142/88', '98.5 F', '80 bpm'],
      ['MR-2026-0006', patientIds[5], doc2Id, apptIds[5], '2026-11-12', 'Throbbing unilateral headache', 'Migraine without Aura', 'Sumatriptan 50mg at onset, hydration, sleep hygiene counseling', 'Neurological exam intact', 'STABLE', '118/74', '98.1 F', '70 bpm'],
      ['MR-2026-0007', patientIds[6], doc1Id, apptIds[6], '2026-11-14', 'Palpitations and dizziness', 'Paroxysmal Atrial Fibrillation', 'Metoprolol Succinate 50mg OD, Apixaban 5mg BD, strict anticoagulation monitoring', 'CHA2DS2-VASc score 3; stabilized in ER', 'STABLE', '130/78', '98.0 F', '88 bpm'],
      ['MR-2026-0008', patientIds[7], doc3Id, apptIds[7], '2026-11-16', 'Lower back radiating pain', 'L4-L5 Lumbar Disc Prolapse', 'Pregabalin 75mg HS, core strengthening physiotherapy, ergonomic posture', 'Straight leg raise positive at 50 deg right', 'UNDER_OBSERVATION', '122/78', '98.3 F', '76 bpm'],
      ['MR-2026-0009', patientIds[8], doc4Id, apptIds[8], '2026-11-18', 'Routine wellness check', 'Healthy Adolescent Growth', 'Routine nutrition & immunization schedule maintained', 'Height/Weight at 75th percentile', 'RECOVERED', '106/70', '98.2 F', '78 bpm'],
      ['MR-2026-0010', patientIds[9], doc5Id, apptIds[9], '2026-11-20', 'Fatigue and weight gain', 'Subclinical Hypothyroidism & Pre-diabetes', 'Levothyroxine 25mcg empty stomach, repeat TSH and HbA1c in 8 weeks', 'TSH 7.4 mIU/L, HbA1c 6.1%', 'IMPROVING', '126/82', '98.4 F', '68 bpm'],
    ];
    const recIds: Array<number | bigint> = [];
    for (const row of recordsSeed) {
      recIds.push(insertRec.run(...row).lastInsertRowid);
    }

    // 9. Medicines (15) - Current date is 2026-11-22
    // Include normal stock, low stock (< reorder_level), near-expiry (2026-12-xx), and 1 expired (2026-09-15)
    const insertMed = db.prepare(`
      INSERT INTO medicines (medicine_code, medicine_name, batch_number, category, available_quantity, reorder_level, unit_price, expiry_date, supplier, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const medsSeed = [
      ['MED-0001', 'Telmisartan 40mg Tablet', 'BCH-TEL-2601', 'Cardiovascular', 240, 40, 14.50, '2028-03-31', 'Sun Pharma Distributors', 'ARB antihypertensive tablet'],
      ['MED-0002', 'Paracetamol 650mg Tablet', 'BCH-PCM-2604', 'Analgesic', 520, 100, 3.20, '2028-06-30', 'Cipla MedSupply', 'Antipyretic and analgesic'],
      ['MED-0003', 'Atorvastatin 20mg Tablet', 'BCH-ATV-2602', 'Cardiovascular', 180, 35, 18.00, '2027-11-30', 'Dr. Reddy Labs', 'HMG-CoA reductase inhibitor'],
      ['MED-0004', 'Aspirin 75mg Gastro-Resistant', 'BCH-ASP-2607', 'Antiplatelet', 310, 50, 4.50, '2028-01-15', 'Bayer Healthcare India', 'Low-dose cardiac prophylaxis'],
      ['MED-0005', 'Azithromycin 200mg/5ml Syrup', 'BCH-AZM-2609', 'Antibiotic', 18, 25, 78.00, '2027-05-20', 'Abbott Pharma', 'Pediatric macrolide suspension (Low Stock)'],
      ['MED-0006', 'Aceclofenac 100mg Tablet', 'BCH-ACF-2611', 'NSAID', 145, 30, 9.80, '2027-09-30', 'Ipca Laboratories', 'Musculoskeletal anti-inflammatory'],
      ['MED-0007', 'Metoprolol Succinate 50mg ER', 'BCH-MTP-2603', 'Cardiovascular', 95, 30, 16.40, '2027-12-31', 'AstraZeneca India', 'Beta-1 selective blocker'],
      ['MED-0008', 'Apixaban 5mg Tablet', 'BCH-APX-2605', 'Anticoagulant', 14, 20, 62.00, '2027-08-15', 'Pfizer Clinical Supply', 'Direct Factor Xa inhibitor (Low Stock)'],
      ['MED-0009', 'Pregabalin 75mg Capsule', 'BCH-PRG-2608', 'Neurology', 110, 25, 22.50, '2027-10-31', 'Torrent Pharma', 'Neuropathic pain modulator'],
      ['MED-0010', 'Levothyroxine 25mcg Tablet', 'BCH-LVT-2610', 'Endocrine', 200, 40, 5.60, '2028-04-30', 'Abbott Pharma', 'Thyroid hormone replacement'],
      ['MED-0011', 'Amoxicillin + Clavulanate 625mg', 'BCH-AMC-2612', 'Antibiotic', 65, 30, 28.00, '2026-12-12', 'GlaxoSmithKline India', 'Broad-spectrum penicillin (Near Expiry)'],
      ['MED-0012', 'Pantoprazole 40mg Gastro Tablet', 'BCH-PNT-2613', 'Gastrointestinal', 190, 40, 8.90, '2026-12-18', 'Alkem Laboratories', 'Proton pump inhibitor (Near Expiry)'],
      ['MED-0013', 'Salbutamol Respules 2.5mg', 'BCH-SLB-2614', 'Respiratory', 12, 20, 15.00, '2027-07-31', 'Cipla MedSupply', 'Bronchodilator nebulizer solution (Low Stock)'],
      ['MED-0014', 'Sumatriptan 50mg Tablet', 'BCH-SMT-2615', 'Neurology', 42, 15, 45.00, '2027-06-30', 'Sun Pharma Distributors', '5-HT1 agonist for acute migraine'],
      ['MED-0015', 'Cefixime 200mg Dispersible', 'BCH-CFX-2501', 'Antibiotic', 34, 25, 19.50, '2026-09-15', 'Lupin Pharmaceuticals', 'Third-generation cephalosporin (Expired)'],
    ];
    const medIds: Array<number | bigint> = [];
    for (const row of medsSeed) {
      medIds.push(insertMed.run(...row).lastInsertRowid);
    }

    // 10. Prescriptions (5) + Prescription Items
    const insertRx = db.prepare(`
      INSERT INTO prescriptions (prescription_code, patient_id, doctor_id, appointment_id, medical_record_id, prescribed_date, status, verified_by, verified_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRxItem = db.prepare(`
      INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity_prescribed, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const rx1 = insertRx.run('RX-2026-0001', patientIds[0], doc1Id, apptIds[0], recIds[0], '2026-11-22', 'DISPENSED', pharma1Id, '2026-11-22T10:15:00', 'Continue 30-day blood pressure regimen').lastInsertRowid;
    insertRxItem.run(rx1, medIds[0], '40 mg', 'Once daily (Morning)', 30, 30, 'Take after breakfast');

    const rx2 = insertRx.run('RX-2026-0002', patientIds[1], doc2Id, apptIds[1], recIds[1], '2026-11-22', 'PENDING', null, null, 'Fever management & gastric protection').lastInsertRowid;
    insertRxItem.run(rx2, medIds[1], '650 mg', 'TID (Every 8 hours)', 5, 15, 'Take after meals if temp > 100F');
    insertRxItem.run(rx2, medIds[11], '40 mg', 'Once daily before breakfast', 5, 5, '30 mins before breakfast');

    const rx3 = insertRx.run('RX-2026-0003', patientIds[2], doc3Id, apptIds[2], recIds[2], '2026-11-22', 'DISPENSED', pharma1Id, '2026-11-22T11:20:00', 'Post-op pain & inflammation protocol').lastInsertRowid;
    insertRxItem.run(rx3, medIds[5], '100 mg', 'Twice daily (BD)', 5, 10, 'Take with food');

    const rx4 = insertRx.run('RX-2026-0004', patientIds[3], doc4Id, apptIds[3], recIds[3], '2026-11-22', 'PENDING', null, null, 'Pediatric bronchitis therapy').lastInsertRowid;
    insertRxItem.run(rx4, medIds[4], '5 ml', 'Once daily', 3, 1, 'Shake bottle well before measuring');
    insertRxItem.run(rx4, medIds[12], '2.5 mg', 'Twice daily via nebulizer', 5, 10, 'Use pediatric mask');

    const rx5 = insertRx.run('RX-2026-0005', patientIds[4], doc1Id, apptIds[4], recIds[4], '2026-11-22', 'PENDING', null, null, 'Cardioprotective & lipid lowering regimen').lastInsertRowid;
    insertRxItem.run(rx5, medIds[2], '20 mg', 'Once daily at bedtime', 30, 30, 'Take at night');
    insertRxItem.run(rx5, medIds[3], '75 mg', 'Once daily after lunch', 30, 30, 'Do not crush enteric tablet');

    // 11. Diagnostic Tests (6)
    const insertTest = db.prepare(`
      INSERT INTO diagnostic_tests (test_code, patient_id, doctor_id, appointment_id, test_name, test_category, priority, requested_date, status, result_summary, report_notes, test_charge, reported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTest.run('TST-2026-0001', patientIds[0], doc1Id, apptIds[0], '12-Lead Resting ECG', 'Cardiology', 'ROUTINE', '2026-11-22', 'COMPLETED', 'Normal Sinus Rhythm · 74 bpm', 'No acute ST-T wave changes or conduction block observed.', 650, '2026-11-22T10:05:00');
    insertTest.run('TST-2026-0002', patientIds[1], doc2Id, apptIds[1], 'Complete Blood Count (CBC) + Dengue NS1', 'Hematology', 'URGENT', '2026-11-22', 'REQUESTED', null, null, 950, null);
    insertTest.run('TST-2026-0003', patientIds[2], doc3Id, apptIds[2], 'Right Knee AP/Lateral X-Ray', 'Radiology', 'ROUTINE', '2026-11-22', 'COMPLETED', 'Prosthesis alignment satisfactory', 'No periprosthetic loosening or fracture line seen.', 850, '2026-11-22T11:10:00');
    insertTest.run('TST-2026-0004', patientIds[4], doc1Id, apptIds[4], 'Fasting Lipid Profile & Troponin-I', 'Biochemistry', 'URGENT', '2026-11-22', 'IN_PROGRESS', null, 'Sample received at Central Biochemistry Lab', 1400, null);
    insertTest.run('TST-2026-0005', patientIds[7], doc3Id, apptIds[7], 'MRI Lumbar Spine', 'Radiology', 'ROUTINE', '2026-11-16', 'COMPLETED', 'Mild L4-L5 posterocentral disc bulge', 'Mild right neural foraminal narrowing without cord compression.', 4200, '2026-11-17T15:30:00');
    insertTest.run('TST-2026-0006', patientIds[9], doc5Id, apptIds[9], 'Thyroid Profile (TSH, Free T4) & HbA1c', 'Endocrinology', 'ROUTINE', '2026-11-20', 'COMPLETED', 'TSH 7.4 mIU/L (High) · HbA1c 6.1%', 'Consistent with subclinical hypothyroidism and impaired glucose tolerance.', 1100, '2026-11-20T17:45:00');

    // 12. Billing (5)
    const insertBill = db.prepare(`
      INSERT INTO billing (bill_code, patient_id, appointment_id, prescription_id, consultation_charges, medicine_charges, diagnostic_charges, total_amount, paid_amount, payment_status, payment_method, billed_by, billed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBill.run('INV-2026-0001', patientIds[0], apptIds[0], rx1, 900, 435, 650, 1985, 1985, 'PAID', 'UPI', pharma1Id, '2026-11-22T10:25:00', 'Cardiology OPD + Telmisartan 30 tabs + ECG');
    insertBill.run('INV-2026-0002', patientIds[1], apptIds[1], rx2, 600, 92.5, 950, 1642.5, 0, 'PENDING', null, pharma1Id, '2026-11-22T10:45:00', 'General Medicine OPD + Pending pharmacy & lab');
    insertBill.run('INV-2026-0003', patientIds[2], apptIds[2], rx3, 800, 98, 850, 1748, 1748, 'PAID', 'CARD', pharma1Id, '2026-11-22T11:30:00', 'Orthopedics follow-up + X-Ray + meds');
    insertBill.run('INV-2026-0004', patientIds[7], apptIds[7], null, 800, 0, 4200, 5000, 2500, 'PARTIAL', 'CASH', pharma1Id, '2026-11-16T14:20:00', 'Advance paid for Lumbar Spine MRI');
    insertBill.run('INV-2026-0005', patientIds[9], apptIds[9], null, 550, 0, 1100, 1650, 1650, 'PAID', 'UPI', pharma1Id, '2026-11-20T18:00:00', 'Pathology panel consultation & lab');
  });

  runSeed();
  seedInitialVisits();
}

function seedInitialVisits(): void {
  const visitCount = (db.prepare('SELECT COUNT(*) as cnt FROM patient_visits').get() as { cnt: number }).cnt;
  if (visitCount > 0) return;

  const regUser = db.prepare(`SELECT id FROM users WHERE staff_code = 'STF-REG-001'`).get() as { id: number } | undefined;
  const fallbackReg = db.prepare(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).get() as { id: number } | undefined;
  const staffId = regUser?.id ?? fallbackReg?.id ?? 1;

  const patients = db
    .prepare(`SELECT id, patient_code, assigned_department_id, assigned_doctor_id FROM patients ORDER BY id ASC LIMIT 10`)
    .all() as Array<{ id: number; patient_code: string; assigned_department_id: number | null; assigned_doctor_id: number | null }>;
  if (patients.length === 0) return;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterday = `${yesterdayDate.getFullYear()}-${pad(yesterdayDate.getMonth() + 1)}-${pad(yesterdayDate.getDate())}`;
  const twoDaysAgoDate = new Date(now.getTime() - 2 * 86400000);
  const twoDaysAgo = `${twoDaysAgoDate.getFullYear()}-${pad(twoDaysAgoDate.getMonth() + 1)}-${pad(twoDaysAgoDate.getDate())}`;

  const insertVisit = db.prepare(`
    INSERT INTO patient_visits (
      visit_code, patient_id, department_id, doctor_id, appointment_id,
      visit_type, purpose, visit_date, check_in_time, check_out_time, status, notes, recorded_by, checked_out_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const p = (idx: number) => patients[idx % patients.length];

    const seedRows: Array<{
      code: string;
      ptIdx: number;
      type: string;
      purpose: string;
      date: string;
      inTime: string;
      outTime: string | null;
      status: 'CHECKED_OUT' | 'IN_HOSPITAL';
      notes: string;
    }> = [
      {
        code: 'VST-2026-0001',
        ptIdx: 0,
        type: 'OPD',
        purpose: 'Hypertension follow-up & resting ECG review',
        date: twoDaysAgo,
        inTime: `${twoDaysAgo}T09:15`,
        outTime: `${twoDaysAgo}T10:35`,
        status: 'CHECKED_OUT',
        notes: 'Prescription collected at pharmacy desk before departure.',
      },
      {
        code: 'VST-2026-0002',
        ptIdx: 7,
        type: 'DIAGNOSTIC',
        purpose: 'MRI Lumbar Spine scan & Orthopedic review',
        date: twoDaysAgo,
        inTime: `${twoDaysAgo}T13:40`,
        outTime: `${twoDaysAgo}T15:10`,
        status: 'CHECKED_OUT',
        notes: 'Diagnostic report uploaded to portal.',
      },
      {
        code: 'VST-2026-0003',
        ptIdx: 9,
        type: 'DIAGNOSTIC',
        purpose: 'Thyroid Profile & HbA1c blood sample collection',
        date: yesterday,
        inTime: `${yesterday}T08:45`,
        outTime: `${yesterday}T09:50`,
        status: 'CHECKED_OUT',
        notes: 'Fasting sample completed cleanly.',
      },
      {
        code: 'VST-2026-0004',
        ptIdx: 2,
        type: 'FOLLOW_UP',
        purpose: 'Post-TKR orthopedic knee flexion physiotherapy',
        date: yesterday,
        inTime: `${yesterday}T10:20`,
        outTime: `${yesterday}T11:45`,
        status: 'CHECKED_OUT',
        notes: 'Follow-up rehabilitation progress recorded.',
      },
      {
        code: 'VST-2026-0005',
        ptIdx: 4,
        type: 'OPD',
        purpose: 'Cardiology stress evaluation & lipid workup',
        date: today,
        inTime: `${today}T08:30`,
        outTime: `${today}T09:55`,
        status: 'CHECKED_OUT',
        notes: 'Cleared for discharge after troponin negative.',
      },
      {
        code: 'VST-2026-0006',
        ptIdx: 0,
        type: 'PHARMACY',
        purpose: 'Monthly antihypertensive medication refill',
        date: today,
        inTime: `${today}T09:10`,
        outTime: `${today}T09:35`,
        status: 'CHECKED_OUT',
        notes: 'Quick pharmacy pickup completed.',
      },
      {
        code: 'VST-2026-0007',
        ptIdx: 1,
        type: 'OPD',
        purpose: 'High-grade fever & dengue NS1 observation',
        date: today,
        inTime: `${today}T09:50`,
        outTime: null,
        status: 'IN_HOSPITAL',
        notes: 'Awaiting CBC lab report and hydration monitoring.',
      },
      {
        code: 'VST-2026-0008',
        ptIdx: 3,
        type: 'OPD',
        purpose: 'Pediatric bronchitis nebulization session',
        date: today,
        inTime: `${today}T10:25`,
        outTime: null,
        status: 'IN_HOSPITAL',
        notes: 'In pediatric observation bay with guardian.',
      },
      {
        code: 'VST-2026-0009',
        ptIdx: 5,
        type: 'OPD',
        purpose: 'General Medicine migraine & Vitamin D consultation',
        date: today,
        inTime: `${today}T11:05`,
        outTime: null,
        status: 'IN_HOSPITAL',
        notes: 'Waiting outside OPD Room 104.',
      },
    ];

    for (const row of seedRows) {
      const pt = p(row.ptIdx);
      insertVisit.run(
        row.code,
        pt.id,
        pt.assigned_department_id,
        pt.assigned_doctor_id,
        null,
        row.type,
        row.purpose,
        row.date,
        row.inTime,
        row.outTime,
        row.status,
        row.notes,
        staffId,
        row.status === 'CHECKED_OUT' ? staffId : null
      );
    }
  });

  tx();
}
