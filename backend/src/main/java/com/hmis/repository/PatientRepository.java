package com.hmis.repository;

import com.hmis.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PatientRepository extends JpaRepository<Patient, Long> {
    Optional<Patient> findByPatientCodeIgnoreCase(String patientCode);

    @Query("SELECT p FROM Patient p WHERE UPPER(p.patientCode) LIKE UPPER(CONCAT('%', :q, '%')) " +
           "OR LOWER(p.fullName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR p.mobileNumber LIKE CONCAT('%', :q, '%')")
    List<Patient> searchPatients(@Param("q") String query);
}
