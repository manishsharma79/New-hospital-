package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.service.DoctorService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/doctor")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<?>> dashboard(Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok(doctorService.getDashboard(auth.getName())));
    }

    @GetMapping("/patients")
    public ResponseEntity<ApiResponse<?>> patients() {
        return ResponseEntity.ok(ApiResponse.ok(doctorService.getPatients()));
    }

    @PostMapping("/diagnosis")
    public ResponseEntity<ApiResponse<?>> addDiagnosis(@RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Diagnosis recorded", doctorService.addDiagnosis(body, auth.getName())));
    }

    @PostMapping("/treatment")
    public ResponseEntity<ApiResponse<?>> addTreatment(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Treatment updated", doctorService.addTreatment(body)));
    }

    @PutMapping("/progress")
    public ResponseEntity<ApiResponse<?>> updateProgress(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Progress updated", doctorService.updateProgress(body)));
    }

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<?>> reports() {
        return ResponseEntity.ok(ApiResponse.ok(doctorService.getDiagnosticReports()));
    }
}
