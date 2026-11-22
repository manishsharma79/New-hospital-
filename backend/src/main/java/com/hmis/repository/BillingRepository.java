package com.hmis.repository;

import com.hmis.entity.Billing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BillingRepository extends JpaRepository<Billing, Long> {
    boolean existsByPrescriptionId(Long prescriptionId);
    List<Billing> findByPatientIdOrderByBilledAtDesc(Long patientId);
}
