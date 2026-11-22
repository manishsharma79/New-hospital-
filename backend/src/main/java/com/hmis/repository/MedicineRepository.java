package com.hmis.repository;

import com.hmis.entity.Medicine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface MedicineRepository extends JpaRepository<Medicine, Long> {
    boolean existsByBatchNumberIgnoreCase(String batchNumber);

    @Query("SELECT m FROM Medicine m WHERE m.availableQuantity <= m.reorderLevel ORDER BY m.availableQuantity ASC")
    List<Medicine> findLowStockMedicines();

    List<Medicine> findByExpiryDateBeforeOrderByExpiryDateAsc(LocalDate date);

    List<Medicine> findByExpiryDateBetweenOrderByExpiryDateAsc(LocalDate start, LocalDate end);

    @Query("SELECT m FROM Medicine m WHERE LOWER(m.medicineName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR UPPER(m.medicineCode) LIKE UPPER(CONCAT('%', :q, '%'))")
    List<Medicine> searchMedicines(@Param("q") String query);
}
