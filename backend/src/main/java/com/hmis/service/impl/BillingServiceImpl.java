package com.hmis.service.impl;

import com.hmis.entity.Billing;
import com.hmis.enums.PaymentStatus;
import com.hmis.exception.BusinessRuleException;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.*;
import com.hmis.service.BillingService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class BillingServiceImpl implements BillingService {

    private final BillingRepository billingRepository;
    private final PatientRepository patientRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final UserRepository userRepository;

    public BillingServiceImpl(BillingRepository billingRepository, PatientRepository patientRepository,
                              PrescriptionRepository prescriptionRepository, UserRepository userRepository) {
        this.billingRepository = billingRepository;
        this.patientRepository = patientRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public Billing generateBill(Map<String, Object> payload, String billedByEmail) {
        Long patientId = Long.valueOf(String.valueOf(payload.get("patientId")));
        if (payload.get("prescriptionId") != null) {
            Long rxId = Long.valueOf(String.valueOf(payload.get("prescriptionId")));
            if (billingRepository.existsByPrescriptionId(rxId)) {
                throw new BusinessRuleException("Duplicate billing prevented for prescription", HttpStatus.CONFLICT);
            }
        }

        BigDecimal consult = new BigDecimal(String.valueOf(payload.getOrDefault("consultationCharges", "0")));
        BigDecimal medicine = new BigDecimal(String.valueOf(payload.getOrDefault("medicineCharges", "0")));
        BigDecimal diag = new BigDecimal(String.valueOf(payload.getOrDefault("diagnosticCharges", "0")));
        BigDecimal total = consult.add(medicine).add(diag);
        BigDecimal paid = new BigDecimal(String.valueOf(payload.getOrDefault("paidAmount", "0")));

        Billing b = new Billing();
        b.setBillCode(String.format("INV-2026-%04d", billingRepository.count() + 1));
        b.setPatient(patientRepository.findById(patientId).orElseThrow(() -> new ResourceNotFoundException("Patient not found")));
        if (payload.get("prescriptionId") != null) {
            prescriptionRepository.findById(Long.valueOf(String.valueOf(payload.get("prescriptionId")))).ifPresent(b::setPrescription);
        }
        b.setConsultationCharges(consult);
        b.setMedicineCharges(medicine);
        b.setDiagnosticCharges(diag);
        b.setTotalAmount(total);
        b.setPaidAmount(paid);
        b.setPaymentStatus(paid.compareTo(total) >= 0 ? PaymentStatus.PAID : paid.compareTo(BigDecimal.ZERO) > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING);
        b.setPaymentMethod((String) payload.get("paymentMethod"));
        b.setBilledAt(LocalDateTime.now());
        userRepository.findByEmailIgnoreCase(billedByEmail).ifPresent(b::setBilledBy);

        return billingRepository.save(b);
    }

    @Override
    public List<Billing> getAllBills() { return billingRepository.findAll(); }

    @Override
    public Billing getBill(Long id) {
        return billingRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
    }

    @Override
    @Transactional
    public Billing updatePaymentStatus(Long id, Map<String, Object> payload) {
        Billing b = getBill(id);
        if (payload.get("paidAmount") != null) {
            b.setPaidAmount(new BigDecimal(String.valueOf(payload.get("paidAmount"))));
        }
        if (payload.get("paymentStatus") != null) {
            b.setPaymentStatus(PaymentStatus.valueOf(String.valueOf(payload.get("paymentStatus")).toUpperCase()));
        }
        return billingRepository.save(b);
    }
}
