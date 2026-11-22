package com.hmis.repository;

import com.hmis.entity.Prescription;
import com.hmis.enums.PrescriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    List<Prescription> findByPatientIdOrderByPrescribedDateDesc(Long patientId);
    List<Prescription> findByStatusOrderByPrescribedDateDesc(PrescriptionStatus status);
}
