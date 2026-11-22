package com.hmis.service.impl;

import com.hmis.entity.Medicine;
import com.hmis.enums.PrescriptionStatus;
import com.hmis.exception.BusinessRuleException;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.MedicineRepository;
import com.hmis.repository.PrescriptionRepository;
import com.hmis.service.PharmacistService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class PharmacistServiceImpl implements PharmacistService {

    private final MedicineRepository medicineRepository;
    private final PrescriptionRepository prescriptionRepository;

    public PharmacistServiceImpl(MedicineRepository medicineRepository, PrescriptionRepository prescriptionRepository) {
        this.medicineRepository = medicineRepository;
        this.prescriptionRepository = prescriptionRepository;
    }

    @Override
    public Map<String, Object> getDashboard() {
        LocalDate today = LocalDate.now();
        return Map.of(
                "totalMedicines", medicineRepository.count(),
                "lowStockCount", medicineRepository.findLowStockMedicines().size(),
                "expiredCount", medicineRepository.findByExpiryDateBeforeOrderByExpiryDateAsc(today).size(),
                "nearExpiryCount", medicineRepository.findByExpiryDateBetweenOrderByExpiryDateAsc(today, today.plusDays(30)).size(),
                "pendingPrescriptions", prescriptionRepository.findByStatusOrderByPrescribedDateDesc(PrescriptionStatus.PENDING).size()
        );
    }

    @Override
    public List<Medicine> getAllMedicines() {
        return medicineRepository.findAll();
    }

    @Override
    @Transactional
    public Medicine addMedicine(Map<String, Object> payload) {
        String batch = String.valueOf(payload.get("batchNumber")).trim().toUpperCase();
        if (medicineRepository.existsByBatchNumberIgnoreCase(batch)) {
            throw new BusinessRuleException("Batch number already exists", HttpStatus.CONFLICT);
        }
        Medicine m = new Medicine();
        m.setMedicineCode(String.format("MED-%04d", medicineRepository.count() + 1));
        m.setMedicineName(String.valueOf(payload.get("medicineName")).trim());
        m.setBatchNumber(batch);
        m.setCategory(String.valueOf(payload.get("category")).trim());
        m.setAvailableQuantity(Integer.valueOf(String.valueOf(payload.get("availableQuantity"))));
        m.setUnitPrice(new BigDecimal(String.valueOf(payload.get("unitPrice"))));
        m.setExpiryDate(LocalDate.parse(String.valueOf(payload.get("expiryDate"))));
        m.setSupplier(String.valueOf(payload.get("supplier")).trim());
        return medicineRepository.save(m);
    }

    @Override
    @Transactional
    public Medicine updateMedicine(Long id, Map<String, Object> payload) {
        Medicine m = medicineRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));
        if (payload.get("medicineName") != null) m.setMedicineName(String.valueOf(payload.get("medicineName")));
        if (payload.get("unitPrice") != null) m.setUnitPrice(new BigDecimal(String.valueOf(payload.get("unitPrice"))));
        if (payload.get("availableQuantity") != null) m.setAvailableQuantity(Integer.valueOf(String.valueOf(payload.get("availableQuantity"))));
        return medicineRepository.save(m);
    }

    @Override
    @Transactional
    public Medicine updateStock(Long id, Integer newQuantity) {
        Medicine m = medicineRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));
        m.setAvailableQuantity(Math.max(0, newQuantity));
        return medicineRepository.save(m);
    }

    @Override
    @Transactional
    public void deleteMedicine(Long id) {
        medicineRepository.deleteById(id);
    }

    @Override
    public List<Medicine> getLowStockMedicines() {
        return medicineRepository.findLowStockMedicines();
    }

    @Override
    public List<Medicine> getExpiredMedicines() {
        return medicineRepository.findByExpiryDateBeforeOrderByExpiryDateAsc(LocalDate.now());
    }

    @Override
    public List<Medicine> getNearExpiryMedicines() {
        LocalDate today = LocalDate.now();
        return medicineRepository.findByExpiryDateBetweenOrderByExpiryDateAsc(today, today.plusDays(30));
    }
}
