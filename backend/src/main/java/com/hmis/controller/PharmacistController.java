package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.service.PharmacistService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class PharmacistController {

    private final PharmacistService pharmacistService;

    public PharmacistController(PharmacistService pharmacistService) {
        this.pharmacistService = pharmacistService;
    }

    @GetMapping("/pharmacist/dashboard")
    public ResponseEntity<ApiResponse<?>> dashboard() {
        return ResponseEntity.ok(ApiResponse.ok(pharmacistService.getDashboard()));
    }

    @GetMapping("/medicines")
    public ResponseEntity<ApiResponse<?>> listMedicines() {
        return ResponseEntity.ok(ApiResponse.ok(pharmacistService.getAllMedicines()));
    }

    @PostMapping("/medicines")
    public ResponseEntity<ApiResponse<?>> addMedicine(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Medicine added", pharmacistService.addMedicine(body)));
    }

    @PutMapping("/medicines/{id}")
    public ResponseEntity<ApiResponse<?>> updateMedicine(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Medicine updated", pharmacistService.updateMedicine(id, body)));
    }

    @DeleteMapping("/medicines/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMedicine(@PathVariable Long id) {
        pharmacistService.deleteMedicine(id);
        return ResponseEntity.ok(ApiResponse.ok("Medicine deleted", null));
    }

    @PutMapping("/medicines/{id}/stock")
    public ResponseEntity<ApiResponse<?>> updateStock(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(ApiResponse.ok("Stock updated",
                pharmacistService.updateStock(id, body.get("absoluteQuantity"))));
    }

    @GetMapping("/medicines/low-stock")
    public ResponseEntity<ApiResponse<?>> lowStock() {
        return ResponseEntity.ok(ApiResponse.ok(pharmacistService.getLowStockMedicines()));
    }

    @GetMapping("/medicines/expired")
    public ResponseEntity<ApiResponse<?>> expired() {
        return ResponseEntity.ok(ApiResponse.ok(pharmacistService.getExpiredMedicines()));
    }

    @GetMapping("/medicines/near-expiry")
    public ResponseEntity<ApiResponse<?>> nearExpiry() {
        return ResponseEntity.ok(ApiResponse.ok(pharmacistService.getNearExpiryMedicines()));
    }
}
