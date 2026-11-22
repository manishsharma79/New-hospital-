package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.service.PatientService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<?>> register(@RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Patient registered", patientService.registerPatient(body, auth.getName())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<?>> list() {
        return ResponseEntity.ok(ApiResponse.ok(patientService.getAllPatients()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<?>> getOne(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(patientService.getPatientByIdOrCode(id)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<?>> search(@RequestParam("q") String q) {
        return ResponseEntity.ok(ApiResponse.ok(patientService.searchPatients(q)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<?>> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Patient updated", patientService.updatePatient(id, body)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        patientService.deletePatient(id);
        return ResponseEntity.ok(ApiResponse.ok("Patient deleted", null));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<ApiResponse<?>> history(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(patientService.getPatientHistory(id)));
    }
}
