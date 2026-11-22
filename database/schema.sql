-- ============================================================================
-- Hospital Management Information System — MySQL 8 Relational Database Schema
-- Database: hmis_database
-- DFD Data Stores Preserved:
--   1. User File       -> users, roles, permissions, role_permissions, staff_schedules
--   2. Patient File    -> patients (supported by departments, staff_schedules)
--   3. Appointment File-> appointments
--   4. Medical Record  -> medical_records, diagnostic_tests, prescriptions, prescription_items
--   5. Billing File    -> billing
--   6. Medicine/Stock  -> medicines
-- ============================================================================

CREATE DATABASE IF NOT EXISTS hmis_database
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hmis_database;

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  module VARCHAR(60) NOT NULL,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- 3. Role-Permissions Join Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  department_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  head_doctor_name VARCHAR(120),
  location VARCHAR(120),
  phone_ext VARCHAR(20),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Users / Staff Table (DFD Data Store: User File)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  specialization VARCHAR(120),
  qualification VARCHAR(120),
  consultation_fee DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
  department_id BIGINT,
  role_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role_id),
  INDEX idx_users_dept (department_id),
  CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. Staff Schedules Table
CREATE TABLE IF NOT EXISTS staff_schedules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  department_id BIGINT,
  day_of_week VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  slot_duration_minutes INT NOT NULL DEFAULT 30,
  max_patients INT NOT NULL DEFAULT 14,
  room_number VARCHAR(30),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sched_staff_day (staff_id, day_of_week),
  CONSTRAINT fk_sched_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sched_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7. Patients Table (DFD Data Store: Patient File)
CREATE TABLE IF NOT EXISTS patients (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  dob DATE NOT NULL,
  age INT NOT NULL,
  gender VARCHAR(20) NOT NULL,
  blood_group VARCHAR(10),
  marital_status VARCHAR(20),
  mobile_number VARCHAR(25) NOT NULL,
  alternate_phone VARCHAR(25),
  email VARCHAR(150),
  house_number VARCHAR(50),
  street_locality VARCHAR(150),
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80) NOT NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'India',
  pin_code VARCHAR(20),
  emergency_contact_name VARCHAR(150) NOT NULL,
  emergency_relationship VARCHAR(50) NOT NULL,
  emergency_contact_number VARCHAR(25) NOT NULL,
  id_proof_type VARCHAR(50),
  id_proof_number VARCHAR(80),
  registration_date DATE NOT NULL,
  registration_type VARCHAR(20) NOT NULL DEFAULT 'OPD',
  assigned_department_id BIGINT,
  assigned_doctor_id BIGINT,
  created_by BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_code (patient_code),
  INDEX idx_patients_mobile (mobile_number),
  CONSTRAINT fk_patients_dept FOREIGN KEY (assigned_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_patients_doctor FOREIGN KEY (assigned_doctor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_patients_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. Appointments Table (DFD Data Store: Appointment File)
CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  appointment_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  appointment_date DATE NOT NULL,
  time_slot VARCHAR(10) NOT NULL,
  visit_type VARCHAR(50) NOT NULL DEFAULT 'Consultation',
  reason VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appt_doctor_date (doctor_id, appointment_date),
  INDEX idx_appt_patient (patient_id),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_appt_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_appt_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. Medical Records Table (DFD Data Store: Medical Record)
CREATE TABLE IF NOT EXISTS medical_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  appointment_id BIGINT,
  visit_date DATE NOT NULL,
  chief_complaint VARCHAR(255),
  diagnosis TEXT NOT NULL,
  treatment_plan TEXT NOT NULL,
  clinical_notes TEXT,
  progress_status VARCHAR(30) NOT NULL DEFAULT 'UNDER_OBSERVATION',
  vitals_bp VARCHAR(30),
  vitals_temp VARCHAR(30),
  vitals_pulse VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mr_patient (patient_id),
  CONSTRAINT fk_mr_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mr_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 10. Medicines Table (DFD Data Store: Medicine/Stock)
CREATE TABLE IF NOT EXISTS medicines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  medicine_code VARCHAR(30) NOT NULL UNIQUE,
  medicine_name VARCHAR(150) NOT NULL,
  batch_number VARCHAR(60) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL,
  available_quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 25,
  unit_price DECIMAL(10, 2) NOT NULL,
  expiry_date DATE NOT NULL,
  supplier VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_med_expiry (expiry_date),
  INDEX idx_med_name (medicine_name)
) ENGINE=InnoDB;

-- 11. Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  prescription_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  appointment_id BIGINT,
  medical_record_id BIGINT,
  prescribed_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  verified_by BIGINT,
  verified_at DATETIME,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rx_patient (patient_id),
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_rx_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rx_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_rx_mr FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
  CONSTRAINT fk_rx_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 12. Prescription Items Table
CREATE TABLE IF NOT EXISTS prescription_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT NOT NULL,
  medicine_id BIGINT NOT NULL,
  dosage VARCHAR(60) NOT NULL,
  frequency VARCHAR(80) NOT NULL,
  duration_days INT NOT NULL,
  quantity_prescribed INT NOT NULL,
  instructions VARCHAR(255),
  CONSTRAINT fk_rxi_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_rxi_med FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 13. Diagnostic Tests Table
CREATE TABLE IF NOT EXISTS diagnostic_tests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  test_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  appointment_id BIGINT,
  test_name VARCHAR(150) NOT NULL,
  test_category VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
  requested_date DATE NOT NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'REQUESTED',
  result_summary VARCHAR(255),
  report_notes TEXT,
  test_charge DECIMAL(10, 2) NOT NULL DEFAULT 450.00,
  reported_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_diag_patient (patient_id),
  CONSTRAINT fk_diag_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_diag_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_diag_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 14. Billing Table (DFD Data Store: Billing File)
CREATE TABLE IF NOT EXISTS billing (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  bill_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id BIGINT NOT NULL,
  appointment_id BIGINT,
  prescription_id BIGINT,
  consultation_charges DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  medicine_charges DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  diagnostic_charges DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(30),
  billed_by BIGINT,
  billed_at DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_patient (patient_id),
  CONSTRAINT fk_bill_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_bill_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_bill_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL,
  CONSTRAINT fk_bill_user FOREIGN KEY (billed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
