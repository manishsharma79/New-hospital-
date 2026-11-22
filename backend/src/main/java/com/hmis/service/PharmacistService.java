package com.hmis.service;

import com.hmis.entity.Medicine;
import java.util.List;
import java.util.Map;

public interface PharmacistService {
    Map<String, Object> getDashboard();
    List<Medicine> getAllMedicines();
    Medicine addMedicine(Map<String, Object> payload);
    Medicine updateMedicine(Long id, Map<String, Object> payload);
    Medicine updateStock(Long id, Integer newQuantity);
    void deleteMedicine(Long id);
    List<Medicine> getLowStockMedicines();
    List<Medicine> getExpiredMedicines();
    List<Medicine> getNearExpiryMedicines();
}
