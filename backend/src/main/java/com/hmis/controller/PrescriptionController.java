package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private final PrescriptionService prescriptionService;

    public PrescriptionController(PrescriptionService prescriptionService) {
        this.prescriptionService = prescriptionService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<?>> create(@RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Prescription created", prescriptionService.createPrescription(body, auth.getName())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<?>> list() {
        return ResponseEntity.ok(ApiResponse.ok(prescriptionService.getAllPrescriptions()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<?>> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(prescriptionService.getPrescription(id)));
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<ApiResponse<?>> verify(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok("Prescription verified and dispensed",
                prescriptionService.verifyAndDispense(id, auth.getName())));
    }
}
