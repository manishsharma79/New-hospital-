package com.hmis.service.impl;

import com.hmis.entity.*;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.*;
import com.hmis.service.DoctorService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class DoctorServiceImpl implements DoctorService {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final AppointmentRepository appointmentRepository;
    private final DiagnosticTestRepository diagnosticTestRepository;

    public DoctorServiceImpl(PatientRepository patientRepository, UserRepository userRepository,
                             MedicalRecordRepository medicalRecordRepository, AppointmentRepository appointmentRepository,
                             DiagnosticTestRepository diagnosticTestRepository) {
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.appointmentRepository = appointmentRepository;
        this.diagnosticTestRepository = diagnosticTestRepository;
    }

    @Override
    public Map<String, Object> getDashboard(String doctorEmail) {
        User doctor = userRepository.findByEmailIgnoreCase(doctorEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
        return Map.of(
                "appointments", appointmentRepository.findByDoctorIdOrderByAppointmentDateDescTimeSlotAsc(doctor.getId()),
                "recordsCount", medicalRecordRepository.findByDoctorIdOrderByVisitDateDesc(doctor.getId()).size()
        );
    }

    @Override
    public List<Patient> getPatients() {
        return patientRepository.findAll();
    }

    @Override
    @Transactional
    public MedicalRecord addDiagnosis(Map<String, Object> payload, String doctorEmail) {
        Long patientId = Long.valueOf(String.valueOf(payload.get("patientId")));
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
        User doctor = userRepository.findByEmailIgnoreCase(doctorEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        MedicalRecord mr = new MedicalRecord();
        mr.setRecordCode(String.format("MR-2026-%04d", medicalRecordRepository.count() + 1));
        mr.setPatient(patient);
        mr.setDoctor(doctor);
        mr.setVisitDate(LocalDate.now());
        mr.setChiefComplaint((String) payload.get("chiefComplaint"));
        mr.setDiagnosis(String.valueOf(payload.get("diagnosis")));
        mr.setTreatmentPlan(String.valueOf(payload.get("treatmentPlan")));
        mr.setClinicalNotes((String) payload.get("clinicalNotes"));
        mr.setProgressStatus(payload.get("progressStatus") != null ? String.valueOf(payload.get("progressStatus")) : "UNDER_OBSERVATION");
        mr.setVitalsBp((String) payload.get("vitalsBp"));
        mr.setVitalsTemp((String) payload.get("vitalsTemp"));
        mr.setVitalsPulse((String) payload.get("vitalsPulse"));
        return medicalRecordRepository.save(mr);
    }

    @Override
    @Transactional
    public MedicalRecord addTreatment(Map<String, Object> payload) {
        Long recordId = Long.valueOf(String.valueOf(payload.get("recordId")));
        MedicalRecord mr = medicalRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found"));
        mr.setTreatmentPlan(String.valueOf(payload.get("treatmentPlan")));
        return medicalRecordRepository.save(mr);
    }

    @Override
    @Transactional
    public MedicalRecord updateProgress(Map<String, Object> payload) {
        Long recordId = Long.valueOf(String.valueOf(payload.get("recordId")));
        MedicalRecord mr = medicalRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found"));
        mr.setProgressStatus(String.valueOf(payload.get("progressStatus")));
        if (payload.get("clinicalNotes") != null) {
            mr.setClinicalNotes(String.valueOf(payload.get("clinicalNotes")));
        }
        return medicalRecordRepository.save(mr);
    }

    @Override
    public List<DiagnosticTest> getDiagnosticReports() {
        return diagnosticTestRepository.findAll();
    }
}
