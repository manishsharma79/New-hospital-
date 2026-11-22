package com.hmis.service;

import com.hmis.entity.Billing;
import java.util.List;
import java.util.Map;

public interface BillingService {
    Billing generateBill(Map<String, Object> payload, String billedByEmail);
    List<Billing> getAllBills();
    Billing getBill(Long id);
    Billing updatePaymentStatus(Long id, Map<String, Object> payload);
}
