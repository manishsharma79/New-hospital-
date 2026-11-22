package com.hmis.service.impl;

import com.hmis.entity.*;
import com.hmis.enums.PrescriptionStatus;
import com.hmis.exception.BusinessRuleException;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.*;
import com.hmis.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class PrescriptionServiceImpl implements PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final MedicineRepository medicineRepository;

    public PrescriptionServiceImpl(PrescriptionRepository prescriptionRepository, PatientRepository patientRepository,
                                   UserRepository userRepository, MedicineRepository medicineRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.medicineRepository = medicineRepository;
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Prescription createPrescription(Map<String, Object> payload, String doctorEmail) {
        Long patientId = Long.valueOf(String.valueOf(payload.get("patientId")));
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
        User doctor = userRepository.findByEmailIgnoreCase(doctorEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        Prescription rx = new Prescription();
        rx.setPrescriptionCode(String.format("RX-2026-%04d", prescriptionRepository.count() + 1));
        rx.setPatient(patient);
        rx.setDoctor(doctor);
        rx.setPrescribedDate(LocalDate.now());
        rx.setStatus(PrescriptionStatus.PENDING);
        rx.setNotes((String) payload.get("notes"));

        List<Map<String, Object>> items = (List<Map<String, Object>>) payload.get("items");
        for (Map<String, Object> itemMap : items) {
            Medicine med = medicineRepository.findById(Long.valueOf(String.valueOf(itemMap.get("medicineId"))))
                    .orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));
            PrescriptionItem item = new PrescriptionItem();
            item.setPrescription(rx);
            item.setMedicine(med);
            item.setDosage(String.valueOf(itemMap.get("dosage")));
            item.setFrequency(String.valueOf(itemMap.get("frequency")));
            item.setDurationDays(Integer.valueOf(String.valueOf(itemMap.get("durationDays"))));
            item.setQuantityPrescribed(Integer.valueOf(String.valueOf(itemMap.get("quantityPrescribed"))));
            rx.getItems().add(item);
        }
        return prescriptionRepository.save(rx);
    }

    @Override
    public List<Prescription> getAllPrescriptions() { return prescriptionRepository.findAll(); }

    @Override
    public Prescription getPrescription(Long id) {
        return prescriptionRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Prescription not found"));
    }

    @Override
    @Transactional
    public Prescription verifyAndDispense(Long id, String pharmacistEmail) {
        Prescription rx = getPrescription(id);
        if (rx.getStatus() == PrescriptionStatus.DISPENSED || rx.getStatus() == PrescriptionStatus.VERIFIED) {
            throw new BusinessRuleException("Duplicate dispensing blocked", HttpStatus.CONFLICT);
        }
        LocalDate today = LocalDate.now();
        for (PrescriptionItem item : rx.getItems()) {
            Medicine med = item.getMedicine();
            if (med.getExpiryDate().isBefore(today)) {
                throw new BusinessRuleException("Expired medicine blocked: " + med.getMedicineName(), HttpStatus.UNPROCESSABLE_ENTITY);
            }
            if (med.getAvailableQuantity() < item.getQuantityPrescribed()) {
                throw new BusinessRuleException("Insufficient stock for " + med.getMedicineName(), HttpStatus.UNPROCESSABLE_ENTITY);
            }
            med.setAvailableQuantity(med.getAvailableQuantity() - item.getQuantityPrescribed());
            medicineRepository.save(med);
        }
        rx.setStatus(PrescriptionStatus.DISPENSED);
        rx.setVerifiedAt(LocalDateTime.now());
        userRepository.findByEmailIgnoreCase(pharmacistEmail).ifPresent(rx::setVerifiedBy);
        return prescriptionRepository.save(rx);
    }
}
