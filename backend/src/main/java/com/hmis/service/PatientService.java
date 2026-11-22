package com.hmis.service;

import com.hmis.entity.Patient;
import java.util.List;
import java.util.Map;

public interface PatientService {
    Patient registerPatient(Map<String, Object> payload, String creatorEmail);
    List<Patient> getAllPatients();
    Patient getPatientByIdOrCode(String idOrCode);
    List<Patient> searchPatients(String query);
    Patient updatePatient(Long id, Map<String, Object> payload);
    void deletePatient(Long id);
    Map<String, Object> getPatientHistory(Long id);
}
