-- ============================================================================
-- Hospital Management Information System — MySQL 8 Seed Data
-- Note: Passwords use BCrypt ($2a$10$...) hashes matching seeded accounts:
--   admin@hmis.edu   / Admin@123  (Neha Kumari)
--   reg1@hmis.edu    / Reg@123    (Manish Sharma)
--   dr.neha@hmis.edu / Doctor@123 (Dr. Neha Kumari)
--   pharma1@hmis.edu / Pharma@123 (Atit Kumar)
-- ============================================================================

USE hmis_database;

INSERT INTO roles (id, name, description) VALUES
  (1, 'ADMIN', 'System Administrator with full hospital governance and analytics'),
  (2, 'REGISTRATION_STAFF', 'Front-desk staff managing patient registration, lookup, and appointments'),
  (3, 'DOCTOR', 'Attending physician managing diagnosis, treatment, prescriptions, and diagnostics'),
  (4, 'PHARMACIST', 'Clinical pharmacist managing inventory, expiry, prescription verification, and billing');

INSERT INTO permissions (id, code, name, module, description) VALUES
  (1, 'STAFF_MANAGE', 'Manage Staff Accounts', 'ADMIN', 'Create, update, and deactivate hospital staff'),
  (2, 'DEPT_MANAGE', 'Manage Departments', 'ADMIN', 'Configure clinical departments and heads'),
  (3, 'ROLE_MANAGE', 'Manage Roles & Permissions', 'ADMIN', 'Assign granular access permissions to roles'),
  (4, 'SCHEDULE_MANAGE', 'Manage Staff Schedules', 'ADMIN', 'Create and adjust weekly clinical rosters'),
  (5, 'BILLING_OVERVIEW', 'View Billing Analytics', 'ADMIN', 'Inspect hospital-wide financial ledger'),
  (6, 'PATIENT_REGISTER', 'Register Patients', 'REGISTRATION', 'Create new patient profiles and HMIS-PAT IDs'),
  (7, 'PATIENT_UPDATE', 'Update Patient Records', 'REGISTRATION', 'Edit demographics, address, and contact details'),
  (8, 'PATIENT_VIEW', 'View Patient Records', 'CLINICAL', 'Search and view patient profiles and history'),
  (9, 'APPOINTMENT_MANAGE', 'Manage Appointments', 'REGISTRATION', 'Schedule, reschedule, and cancel appointments'),
  (10, 'AVAILABILITY_CHECK', 'Check Doctor Availability', 'REGISTRATION', 'Inspect doctor schedules and open slots'),
  (11, 'DIAGNOSIS_WRITE', 'Add Diagnosis & Treatment', 'DOCTOR', 'Record clinical diagnoses, vitals, and progress'),
  (12, 'PRESCRIPTION_CREATE', 'Create Prescriptions', 'DOCTOR', 'Issue digital prescriptions linked to Patient ID'),
  (13, 'DIAGNOSTIC_ORDER', 'Order & View Diagnostics', 'DOCTOR', 'Request lab/imaging tests and review reports'),
  (14, 'MEDICINE_MANAGE', 'Manage Medicine Inventory', 'PHARMACY', 'Add, edit, and replenish medicine stock'),
  (15, 'PRESCRIPTION_VERIFY', 'Verify & Dispense Prescriptions', 'PHARMACY', 'Verify prescriptions and deduct inventory'),
  (16, 'BILLING_MANAGE', 'Generate Bills & Record Payments', 'PHARMACY', 'Compute charges and update payment status');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;
INSERT INTO role_permissions (role_id, permission_id) VALUES
  (2, 6), (2, 7), (2, 8), (2, 9), (2, 10),
  (3, 8), (3, 10), (3, 11), (3, 12), (3, 13),
  (4, 8), (4, 14), (4, 15), (4, 16);

INSERT INTO departments (id, department_code, name, head_doctor_name, location, phone_ext, description, status) VALUES
  (1, 'DEPT-01', 'Cardiology', 'Dr. Neha Kumari', 'Block A · Floor 2', '2101', 'Interventional cardiology, ECG, echocardiography', 'ACTIVE'),
  (2, 'DEPT-02', 'General Medicine', 'Dr. Priya Patel', 'Block A · Floor 1', '2102', 'Internal medicine and primary outpatient care', 'ACTIVE'),
  (3, 'DEPT-03', 'Orthopedics', 'Dr. Vikram Nair', 'Block B · Floor 2', '2201', 'Musculoskeletal surgery and trauma rehabilitation', 'ACTIVE'),
  (4, 'DEPT-04', 'Pediatrics', 'Dr. Sneha Verma', 'Block C · Floor 1', '2301', 'Neonatal, infant, and adolescent clinical care', 'ACTIVE'),
  (5, 'DEPT-05', 'Pathology & Diagnostics', 'Dr. Rohan Iyer', 'Block B · Ground', '2401', 'Clinical biochemistry, hematology, and imaging', 'ACTIVE');

INSERT INTO users (id, staff_code, full_name, email, password_hash, phone, specialization, qualification, consultation_fee, department_id, role_id, status) VALUES
  (1, 'STF-ADM-001', 'Neha Kumari', 'admin@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810010001', 'Hospital Administration', 'MBA Healthcare', 0.00, NULL, 1, 'ACTIVE'),
  (2, 'STF-REG-001', 'Manish Sharma', 'reg1@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810010002', 'Front Desk Operations', 'B.Sc Health Info', 0.00, 2, 2, 'ACTIVE'),
  (3, 'STF-REG-002', 'Karan Malhotra', 'reg2@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810010003', 'Patient Intake & OPD', 'BBA Healthcare', 0.00, 1, 2, 'ACTIVE'),
  (4, 'STF-DOC-001', 'Dr. Neha Kumari', 'dr.neha@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810020001', 'Interventional Cardiology', 'MD, DM Cardiology', 900.00, 1, 3, 'ACTIVE'),
  (5, 'STF-DOC-002', 'Dr. Priya Patel', 'dr.patel@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810020002', 'Internal Medicine', 'MBBS, MD Medicine', 600.00, 2, 3, 'ACTIVE'),
  (6, 'STF-DOC-003', 'Dr. Vikram Nair', 'dr.nair@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810020003', 'Orthopedic Surgery', 'MBBS, MS Ortho', 800.00, 3, 3, 'ACTIVE'),
  (7, 'STF-DOC-004', 'Dr. Sneha Verma', 'dr.verma@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810020004', 'Pediatrics & Neonatology', 'MBBS, MD Pediatrics', 650.00, 4, 3, 'ACTIVE'),
  (8, 'STF-DOC-005', 'Dr. Rohan Iyer', 'dr.iyer@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810020005', 'Clinical Pathology', 'MBBS, MD Pathology', 550.00, 5, 3, 'ACTIVE'),
  (9, 'STF-PHM-001', 'Atit Kumar', 'pharma1@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810030001', 'Chief Clinical Pharmacist', 'M.Pharm', 0.00, NULL, 4, 'ACTIVE'),
  (10, 'STF-PHM-002', 'Siddharth Joshi', 'pharma2@hmis.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+91-9810030002', 'Dispensing Pharmacist', 'B.Pharm', 0.00, NULL, 4, 'ACTIVE');

INSERT INTO staff_schedules (staff_id, department_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, room_number, is_available) VALUES
  (4, 1, 'MONDAY', '09:00', '16:00', 30, 14, 'OPD-201', TRUE),
  (5, 2, 'MONDAY', '09:00', '16:00', 30, 14, 'OPD-104', TRUE),
  (6, 3, 'MONDAY', '09:00', '16:00', 30, 14, 'OPD-208', TRUE),
  (7, 4, 'MONDAY', '09:00', '16:00', 30, 14, 'OPD-112', TRUE),
  (8, 5, 'MONDAY', '09:00', '16:00', 30, 14, 'LAB-003', TRUE);

INSERT INTO patients (id, patient_code, full_name, dob, age, gender, blood_group, marital_status, mobile_number, email, house_number, street_locality, city, state, country, pin_code, emergency_contact_name, emergency_relationship, emergency_contact_number, id_proof_type, id_proof_number, registration_date, registration_type, assigned_department_id, assigned_doctor_id, created_by) VALUES
  (1, 'HMIS-PAT-0001', 'Aarav Mehta', '1982-04-14', 44, 'Male', 'O+', 'Married', '9820112233', 'aarav.mehta@example.com', 'B-402', 'Marine Drive', 'Mumbai', 'Maharashtra', 'India', '400002', 'Kavita Mehta', 'Spouse', '9820112299', 'Aadhaar', 'XXXX-4521-8812', '2026-11-02', 'OPD', 1, 4, 2),
  (2, 'HMIS-PAT-0002', 'Neha Kapoor', '1991-08-22', 35, 'Female', 'A+', 'Married', '9811223344', 'neha.kapoor@example.com', '14', 'Vasant Vihar', 'New Delhi', 'Delhi', 'India', '110057', 'Rakesh Kapoor', 'Spouse', '9811223399', 'PAN', 'ABCPK9123F', '2026-11-04', 'OPD', 2, 5, 2),
  (3, 'HMIS-PAT-0003', 'Suresh Subramanian', '1965-12-03', 60, 'Male', 'B+', 'Married', '9840123456', 'suresh.s@example.com', '28', 'Adyar', 'Chennai', 'Tamil Nadu', 'India', '600020', 'Lakshmi S', 'Spouse', '9840123499', 'Aadhaar', 'XXXX-8890-1244', '2026-11-06', 'IPD', 3, 6, 2),
  (4, 'HMIS-PAT-0004', 'Ishita Banerjee', '2018-06-19', 8, 'Female', 'AB+', 'Single', '9830044556', 'parent.banerjee@example.com', '7A', 'Salt Lake', 'Kolkata', 'West Bengal', 'India', '700091', 'Sourav Banerjee', 'Father', '9830044500', 'Birth Certificate', 'WB-BC-2018-994', '2026-11-08', 'OPD', 4, 7, 2),
  (5, 'HMIS-PAT-0005', 'Mohammed Farhan', '1978-01-29', 48, 'Male', 'O-', 'Married', '9849055667', 'm.farhan@example.com', '8-2-120', 'Banjara Hills', 'Hyderabad', 'Telangana', 'India', '500034', 'Zoya Farhan', 'Spouse', '9849055600', 'Passport', 'Z4491028', '2026-11-10', 'OPD', 1, 4, 2),
  (6, 'HMIS-PAT-0006', 'Divya Menon', '1996-11-05', 30, 'Female', 'B-', 'Single', '9845066778', 'divya.menon@example.com', '310', 'Indiranagar', 'Bengaluru', 'Karnataka', 'India', '560038', 'Radha Menon', 'Mother', '9845066700', 'Driving License', 'KA03-201600491', '2026-11-12', 'OPD', 2, 5, 2),
  (7, 'HMIS-PAT-0007', 'Harshvardhan Rao', '1958-03-11', 68, 'Male', 'A-', 'Widowed', '9823077889', 'h.rao@example.com', '55', 'Koregaon Park', 'Pune', 'Maharashtra', 'India', '411001', 'Nikhil Rao', 'Son', '9823077899', 'Aadhaar', 'XXXX-3319-7720', '2026-11-14', 'EMERGENCY', 1, 4, 2),
  (8, 'HMIS-PAT-0008', 'Rituja Kulkarni', '1988-09-17', 38, 'Female', 'O+', 'Married', '9822088990', 'rituja.k@example.com', '12', 'Shivaji Nagar', 'Pune', 'Maharashtra', 'India', '411005', 'Amey Kulkarni', 'Spouse', '9822088900', 'Aadhaar', 'XXXX-6671-2231', '2026-11-16', 'OPD', 3, 6, 2),
  (9, 'HMIS-PAT-0009', 'Kabir Singhania', '2014-02-25', 12, 'Male', 'B+', 'Single', '9814099001', 'singhania.family@example.com', '99', 'Sector 17', 'Chandigarh', 'Chandigarh', 'India', '160017', 'Rohan Singhania', 'Father', '9814099099', 'Aadhaar', 'XXXX-1190-5501', '2026-11-18', 'OPD', 4, 7, 2),
  (10, 'HMIS-PAT-0010', 'Meenakshi Sundaram', '1973-07-08', 53, 'Female', 'A+', 'Married', '9842010112', 'meenakshi.s@example.com', '42', 'RS Puram', 'Coimbatore', 'Tamil Nadu', 'India', '641002', 'Sundaram V', 'Spouse', '9842010199', 'PAN', 'BGHPS4412L', '2026-11-20', 'OPD', 5, 8, 2);

INSERT INTO appointments (id, appointment_code, patient_id, doctor_id, department_id, appointment_date, time_slot, visit_type, reason, status, created_by) VALUES
  (1, 'APT-2026-0001', 1, 4, 1, '2026-11-22', '09:30', 'Consultation', 'Hypertension follow-up', 'COMPLETED', 2),
  (2, 'APT-2026-0002', 2, 5, 2, '2026-11-22', '10:00', 'Consultation', 'Persistent fever', 'COMPLETED', 2),
  (3, 'APT-2026-0003', 3, 6, 3, '2026-11-22', '10:30', 'Follow-up', 'Post-operative knee check', 'COMPLETED', 2),
  (4, 'APT-2026-0004', 4, 7, 4, '2026-11-22', '11:00', 'Consultation', 'Seasonal bronchitis', 'COMPLETED', 2),
  (5, 'APT-2026-0005', 5, 4, 1, '2026-11-22', '11:30', 'Consultation', 'Exertional chest tightness', 'COMPLETED', 2),
  (6, 'APT-2026-0006', 6, 5, 2, '2026-11-22', '14:00', 'Consultation', 'Migraine evaluation', 'SCHEDULED', 2),
  (7, 'APT-2026-0007', 7, 4, 1, '2026-11-23', '09:00', 'Follow-up', 'Atrial fibrillation check', 'SCHEDULED', 2),
  (8, 'APT-2026-0008', 8, 6, 3, '2026-11-23', '10:00', 'Consultation', 'Lumbar radiculopathy', 'SCHEDULED', 2),
  (9, 'APT-2026-0009', 9, 7, 4, '2026-11-23', '11:30', 'Vaccination', 'Tdap booster', 'SCHEDULED', 2),
  (10, 'APT-2026-0010', 10, 8, 5, '2026-11-21', '15:00', 'Diagnostic Review', 'Thyroid & HbA1c review', 'CANCELLED', 2);

INSERT INTO medicines (id, medicine_code, medicine_name, batch_number, category, available_quantity, reorder_level, unit_price, expiry_date, supplier) VALUES
  (1, 'MED-0001', 'Telmisartan 40mg Tablet', 'BCH-TEL-2601', 'Cardiovascular', 240, 40, 14.50, '2028-03-31', 'Sun Pharma Distributors'),
  (2, 'MED-0002', 'Paracetamol 650mg Tablet', 'BCH-PCM-2604', 'Analgesic', 520, 100, 3.20, '2028-06-30', 'Cipla MedSupply'),
  (3, 'MED-0003', 'Atorvastatin 20mg Tablet', 'BCH-ATV-2602', 'Cardiovascular', 180, 35, 18.00, '2027-11-30', 'Dr. Reddy Labs'),
  (4, 'MED-0004', 'Aspirin 75mg Gastro-Resistant', 'BCH-ASP-2607', 'Antiplatelet', 310, 50, 4.50, '2028-01-15', 'Bayer Healthcare India'),
  (5, 'MED-0005', 'Azithromycin 200mg/5ml Syrup', 'BCH-AZM-2609', 'Antibiotic', 18, 25, 78.00, '2027-05-20', 'Abbott Pharma'),
  (6, 'MED-0006', 'Aceclofenac 100mg Tablet', 'BCH-ACF-2611', 'NSAID', 145, 30, 9.80, '2027-09-30', 'Ipca Laboratories'),
  (7, 'MED-0007', 'Metoprolol Succinate 50mg ER', 'BCH-MTP-2603', 'Cardiovascular', 95, 30, 16.40, '2027-12-31', 'AstraZeneca India'),
  (8, 'MED-0008', 'Apixaban 5mg Tablet', 'BCH-APX-2605', 'Anticoagulant', 14, 20, 62.00, '2027-08-15', 'Pfizer Clinical Supply'),
  (9, 'MED-0009', 'Pregabalin 75mg Capsule', 'BCH-PRG-2608', 'Neurology', 110, 25, 22.50, '2027-10-31', 'Torrent Pharma'),
  (10, 'MED-0010', 'Levothyroxine 25mcg Tablet', 'BCH-LVT-2610', 'Endocrine', 200, 40, 5.60, '2028-04-30', 'Abbott Pharma'),
  (11, 'MED-0011', 'Amoxicillin + Clavulanate 625mg', 'BCH-AMC-2612', 'Antibiotic', 65, 30, 28.00, '2026-12-12', 'GlaxoSmithKline India'),
  (12, 'MED-0012', 'Pantoprazole 40mg Gastro Tablet', 'BCH-PNT-2613', 'Gastrointestinal', 190, 40, 8.90, '2026-12-18', 'Alkem Laboratories'),
  (13, 'MED-0013', 'Salbutamol Respules 2.5mg', 'BCH-SLB-2614', 'Respiratory', 12, 20, 15.00, '2027-07-31', 'Cipla MedSupply'),
  (14, 'MED-0014', 'Sumatriptan 50mg Tablet', 'BCH-SMT-2615', 'Neurology', 42, 15, 45.00, '2027-06-30', 'Sun Pharma Distributors'),
  (15, 'MED-0015', 'Cefixime 200mg Dispersible', 'BCH-CFX-2501', 'Antibiotic', 34, 25, 19.50, '2026-09-15', 'Lupin Pharmaceuticals');
