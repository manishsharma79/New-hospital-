package com.hmis.service;

import com.hmis.entity.Prescription;
import java.util.List;
import java.util.Map;

public interface PrescriptionService {
    Prescription createPrescription(Map<String, Object> payload, String doctorEmail);
    List<Prescription> getAllPrescriptions();
    Prescription getPrescription(Long id);
    Prescription verifyAndDispense(Long id, String pharmacistEmail);
}
