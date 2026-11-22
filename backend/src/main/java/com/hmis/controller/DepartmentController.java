package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.repository.DepartmentRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentRepository departmentRepository;

    public DepartmentController(DepartmentRepository departmentRepository) {
        this.departmentRepository = departmentRepository;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<?>> listActive() {
        return ResponseEntity.ok(ApiResponse.ok(departmentRepository.findByStatusOrderByNameAsc("ACTIVE")));
    }
}
