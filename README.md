# Hospital Management Information System (HMIS)

Full-stack Hospital Management Information System implementing **Context Level (Level 0)**, **Level 1**, and **Level 2 (Process 0.2)** Data Flow Diagrams with four role-based portals (**Administrator**, **Registration Staff**, **Doctor**, and **Pharmacist**).

## Architecture Overview

- **Live Runtime Full-Stack Application (Port 3000)**:
  - **Frontend**: React 19, React Router, Axios, Lucide Icons, Tailwind CSS (`src/`).
  - **Runtime Backend & Persistent SQL Database**: Express REST API (`server.ts`, `server/`) backed by relational SQLite (`hmis_database.db`, 14 relational tables, foreign keys, indexes, atomic transactions, BCrypt password hashing, and JWT Bearer authentication).
- **Java 17 / Spring Boot 3 / MySQL 8 Enterprise Backend Deliverable (`backend/` & `database/`)**:
  - Complete layered Maven Spring Boot codebase (`HmisApplication.java`, `config/`, `controller/`, `entity/`, `repository/`, `service/`, `service/impl/`, `dto/`, `exception/`, `enums/`).
  - MySQL 8 relational schema (`database/schema.sql`) and seed data (`database/seed.sql`) for `hmis_database`.
- **Postman Collection**: `postman/HMIS_Postman_Collection.json`.

## Preserved DFD Structure

- **Level 0 External Entities**: Administrator, Registration Staff, Doctor, Pharmacist.
- **Level 1 Processes**:
  - `0.1` Login -> `User File`
  - `0.2` Manage Patient -> `Patient File`
  - `0.3` Manage Appointment -> `Appointment File`
  - `0.4` Prescribe Tests & Medicines -> `Medical Record`, `Medicine/Stock`
  - `0.5` Manage Billing -> `Billing File`
- **Level 2 (Manage Patient 0.2)**:
  - `0.2.1` New Patient Registration
  - `0.2.2` Search Patient
  - `0.2.3` Update Patient Details
  - `0.2.4` Check Doctor Availability

## Staff Portal Credentials (BCrypt Hashed)

| Role | Staff Member | Email | Password |
| :--- | :--- | :--- | :--- |
| Administrator | Neha Kumari | `admin@hmis.edu` | `Admin@123` |
| Registration Staff | Manish Sharma | `reg1@hmis.edu` | `Reg@123` |
| Doctor (Cardiology) | Dr. Neha Kumari | `dr.neha@hmis.edu` | `Doctor@123` |
| Doctor (General Medicine) | Dr. Priya Patel | `dr.patel@hmis.edu` | `Doctor@123` |
| Pharmacist | Atit Kumar | `pharma1@hmis.edu` | `Pharma@123` |

## Running the Live Preview App

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.
