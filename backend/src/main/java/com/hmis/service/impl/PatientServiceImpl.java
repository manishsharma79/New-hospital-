package com.hmis.service.impl;

import com.hmis.entity.Patient;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.*;
import com.hmis.service.PatientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.Map;

@Service
public class PatientServiceImpl implements PatientService {

    private final PatientRepository patientRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final DiagnosticTestRepository diagnosticTestRepository;
    private final BillingRepository billingRepository;

    public PatientServiceImpl(PatientRepository patientRepository, DepartmentRepository departmentRepository,
                              UserRepository userRepository, AppointmentRepository appointmentRepository,
                              MedicalRecordRepository medicalRecordRepository, PrescriptionRepository prescriptionRepository,
                              DiagnosticTestRepository diagnosticTestRepository, BillingRepository billingRepository) {
        this.patientRepository = patientRepository;
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.diagnosticTestRepository = diagnosticTestRepository;
        this.billingRepository = billingRepository;
    }

    @Override
    @Transactional
    public Patient registerPatient(Map<String, Object> payload, String creatorEmail) {
        Patient p = new Patient();
        long nextNum = patientRepository.count() + 1;
        p.setPatientCode(String.format("HMIS-PAT-%04d", nextNum));

        LocalDate dob = LocalDate.parse(String.valueOf(payload.get("dob")));
        p.setDob(dob);
        p.setAge(Math.max(0, Period.between(dob, LocalDate.now()).getYears()));

        p.setFullName(String.valueOf(payload.get("fullName")).trim());
        p.setGender(String.valueOf(payload.get("gender")));
        p.setBloodGroup((String) payload.get("bloodGroup"));
        p.setMaritalStatus((String) payload.get("maritalStatus"));
        p.setMobileNumber(String.valueOf(payload.get("mobileNumber")));
        p.setAlternatePhone((String) payload.get("alternatePhone"));
        p.setEmail((String) payload.get("email"));
        p.setHouseNumber((String) payload.get("houseNumber"));
        p.setStreetLocality((String) payload.get("streetLocality"));
        p.setCity(String.valueOf(payload.get("city")));
        p.setState(String.valueOf(payload.get("state")));
        p.setCountry(payload.get("country") != null ? String.valueOf(payload.get("country")) : "India");
        p.setPinCode((String) payload.get("pinCode"));
        p.setEmergencyContactName(String.valueOf(payload.get("emergencyContactName")));
        p.setEmergencyRelationship(String.valueOf(payload.get("emergencyRelationship")));
        p.setEmergencyContactNumber(String.valueOf(payload.get("emergencyContactNumber")));
        p.setIdProofType((String) payload.get("idProofType"));
        p.setIdProofNumber((String) payload.get("idProofNumber"));
        p.setRegistrationDate(LocalDate.now());
        p.setRegistrationType(payload.get("registrationType") != null ? String.valueOf(payload.get("registrationType")) : "OPD");

        if (payload.get("assignedDepartmentId") != null) {
            Long deptId = Long.valueOf(String.valueOf(payload.get("assignedDepartmentId")));
            departmentRepository.findById(deptId).ifPresent(p::setAssignedDepartment);
        }
        if (payload.get("assignedDoctorId") != null) {
            Long docId = Long.valueOf(String.valueOf(payload.get("assignedDoctorId")));
            userRepository.findById(docId).ifPresent(p::setAssignedDoctor);
        }
        userRepository.findByEmailIgnoreCase(creatorEmail).ifPresent(p::setCreatedBy);
        return patientRepository.save(p);
    }

    @Override
    public List<Patient> getAllPatients() {
        return patientRepository.findAll();
    }

    @Override
    public Patient getPatientByIdOrCode(String idOrCode) {
        if (idOrCode.matches("\\d+")) {
            return patientRepository.findById(Long.valueOf(idOrCode))
                    .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
        }
        return patientRepository.findByPatientCodeIgnoreCase(idOrCode)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
    }

    @Override
    public List<Patient> searchPatients(String query) {
        return patientRepository.searchPatients(query);
    }

    @Override
    @Transactional
    public Patient updatePatient(Long id, Map<String, Object> payload) {
        Patient p = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
        if (payload.get("fullName") != null) p.setFullName(String.valueOf(payload.get("fullName")));
        if (payload.get("dob") != null) {
            LocalDate dob = LocalDate.parse(String.valueOf(payload.get("dob")));
            p.setDob(dob);
            p.setAge(Math.max(0, Period.between(dob, LocalDate.now()).getYears()));
        }
        if (payload.get("mobileNumber") != null) p.setMobileNumber(String.valueOf(payload.get("mobileNumber")));
        if (payload.get("city") != null) p.setCity(String.valueOf(payload.get("city")));
        if (payload.get("state") != null) p.setState(String.valueOf(payload.get("state")));
        return patientRepository.save(p);
    }

    @Override
    @Transactional
    public void deletePatient(Long id) {
        patientRepository.deleteById(id);
    }

    @Override
    public Map<String, Object> getPatientHistory(Long id) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
        return Map.of(
                "patient", patient,
                "appointments", appointmentRepository.findByPatientIdOrderByAppointmentDateDesc(id),
                "medicalRecords", medicalRecordRepository.findByPatientIdOrderByVisitDateDesc(id),
                "prescriptions", prescriptionRepository.findByPatientIdOrderByPrescribedDateDesc(id),
                "diagnosticTests", diagnosticTestRepository.findByPatientIdOrderByRequestedDateDesc(id),
                "bills", billingRepository.findByPatientIdOrderByBilledAtDesc(id)
        );
    }
}
