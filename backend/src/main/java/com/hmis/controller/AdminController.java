package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.service.AdminService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getDashboardStats()));
    }

    @GetMapping("/staff")
    public ResponseEntity<ApiResponse<?>> listStaff() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getAllStaff()));
    }

    @PostMapping("/staff")
    public ResponseEntity<ApiResponse<?>> createStaff(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Staff added", adminService.addStaff(body)));
    }

    @PutMapping("/staff/{id}")
    public ResponseEntity<ApiResponse<?>> updateStaff(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Staff updated", adminService.updateStaff(id, body)));
    }

    @DeleteMapping("/staff/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteStaff(@PathVariable Long id) {
        adminService.deleteStaff(id);
        return ResponseEntity.ok(ApiResponse.ok("Staff deleted", null));
    }

    @GetMapping("/departments")
    public ResponseEntity<ApiResponse<?>> listDepartments() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getAllDepartments()));
    }

    @PostMapping("/departments")
    public ResponseEntity<ApiResponse<?>> createDepartment(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Department created", adminService.addDepartment(body)));
    }

    @PutMapping("/departments/{id}")
    public ResponseEntity<ApiResponse<?>> updateDepartment(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Department updated", adminService.updateDepartment(id, body)));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDepartment(@PathVariable Long id) {
        adminService.deleteDepartment(id);
        return ResponseEntity.ok(ApiResponse.ok("Department deleted", null));
    }

    @GetMapping("/schedules")
    public ResponseEntity<ApiResponse<?>> listSchedules() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getAllSchedules()));
    }

    @GetMapping("/billing-overview")
    public ResponseEntity<ApiResponse<?>> billingOverview() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getBillingOverview()));
    }
}
