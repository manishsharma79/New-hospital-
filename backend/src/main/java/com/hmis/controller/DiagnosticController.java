package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.entity.DiagnosticTest;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.DiagnosticTestRepository;
import com.hmis.repository.PatientRepository;
import com.hmis.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/diagnostic-tests")
public class DiagnosticController {

    private final DiagnosticTestRepository diagnosticTestRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;

    public DiagnosticController(DiagnosticTestRepository diagnosticTestRepository,
                                PatientRepository patientRepository, UserRepository userRepository) {
        this.diagnosticTestRepository = diagnosticTestRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<?>> create(@RequestBody Map<String, Object> body, Authentication auth) {
        Long patientId = Long.valueOf(String.valueOf(body.get("patientId")));
        DiagnosticTest test = new DiagnosticTest();
        test.setTestCode(String.format("TST-2026-%04d", diagnosticTestRepository.count() + 1));
        test.setPatient(patientRepository.findById(patientId).orElseThrow(() -> new ResourceNotFoundException("Patient not found")));
        test.setDoctor(userRepository.findByEmailIgnoreCase(auth.getName()).orElseThrow());
        test.setTestName(String.valueOf(body.get("testName")));
        test.setTestCategory(String.valueOf(body.get("testCategory")));
        test.setRequestedDate(LocalDate.now());
        test.setTestCharge(new BigDecimal(String.valueOf(body.getOrDefault("testCharge", "650"))));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Test requested", diagnosticTestRepository.save(test)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<?>> list() {
        return ResponseEntity.ok(ApiResponse.ok(diagnosticTestRepository.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<?>> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(diagnosticTestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Diagnostic test not found"))));
    }

    @PutMapping("/{id}/report")
    public ResponseEntity<ApiResponse<?>> updateReport(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        DiagnosticTest test = diagnosticTestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Diagnostic test not found"));
        test.setStatus(String.valueOf(body.getOrDefault("status", "COMPLETED")));
        test.setResultSummary((String) body.get("resultSummary"));
        test.setReportNotes((String) body.get("reportNotes"));
        test.setReportedAt(LocalDateTime.now());
        return ResponseEntity.ok(ApiResponse.ok("Report updated", diagnosticTestRepository.save(test)));
    }
}
