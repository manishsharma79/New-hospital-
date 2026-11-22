package com.hmis.repository;

import com.hmis.entity.DiagnosticTest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DiagnosticTestRepository extends JpaRepository<DiagnosticTest, Long> {
    List<DiagnosticTest> findByPatientIdOrderByRequestedDateDesc(Long patientId);
    List<DiagnosticTest> findByAppointmentId(Long appointmentId);
}
