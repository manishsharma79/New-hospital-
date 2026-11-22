package com.hmis.service;

import com.hmis.entity.DiagnosticTest;
import com.hmis.entity.MedicalRecord;
import com.hmis.entity.Patient;
import java.util.List;
import java.util.Map;

public interface DoctorService {
    Map<String, Object> getDashboard(String doctorEmail);
    List<Patient> getPatients();
    MedicalRecord addDiagnosis(Map<String, Object> payload, String doctorEmail);
    MedicalRecord addTreatment(Map<String, Object> payload);
    MedicalRecord updateProgress(Map<String, Object> payload);
    List<DiagnosticTest> getDiagnosticReports();
}
