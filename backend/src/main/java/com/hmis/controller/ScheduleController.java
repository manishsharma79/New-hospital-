package com.hmis.controller;

import com.hmis.dto.ApiResponse;
import com.hmis.repository.StaffScheduleRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {

    private final StaffScheduleRepository scheduleRepository;

    public ScheduleController(StaffScheduleRepository scheduleRepository) {
        this.scheduleRepository = scheduleRepository;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<?>> listAll() {
        return ResponseEntity.ok(ApiResponse.ok(scheduleRepository.findAll()));
    }
}
