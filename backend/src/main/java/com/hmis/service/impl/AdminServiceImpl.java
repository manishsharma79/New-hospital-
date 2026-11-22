package com.hmis.service.impl;

import com.hmis.entity.*;
import com.hmis.enums.RoleName;
import com.hmis.exception.BusinessRuleException;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.*;
import com.hmis.service.AdminService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final BillingRepository billingRepository;
    private final StaffScheduleRepository scheduleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminServiceImpl(UserRepository userRepository, DepartmentRepository departmentRepository,
                            PatientRepository patientRepository, AppointmentRepository appointmentRepository,
                            BillingRepository billingRepository, StaffScheduleRepository scheduleRepository,
                            RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.billingRepository = billingRepository;
        this.scheduleRepository = scheduleRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public Map<String, Object> getDashboardStats() {
        BigDecimal totalRevenue = billingRepository.findAll().stream()
                .map(Billing::getPaidAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return Map.of(
                "totalStaff", userRepository.count(),
                "totalDoctors", userRepository.countByRole_NameAndStatus(RoleName.DOCTOR, "ACTIVE"),
                "totalPatients", patientRepository.count(),
                "totalDepartments", departmentRepository.count(),
                "totalAppointments", appointmentRepository.count(),
                "totalRevenue", totalRevenue
        );
    }

    @Override
    public List<User> getAllStaff() { return userRepository.findAll(); }

    @Override
    @Transactional
    public User addStaff(Map<String, Object> payload) {
        String email = String.valueOf(payload.get("email")).trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BusinessRuleException("Email already in use", HttpStatus.CONFLICT);
        }
        Role role = roleRepository.findByName(RoleName.valueOf(String.valueOf(payload.get("roleName")).toUpperCase()))
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        User u = new User();
        u.setStaffCode("STF-" + (userRepository.count() + 1));
        u.setFullName(String.valueOf(payload.get("fullName")));
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(String.valueOf(payload.get("password"))));
        u.setRole(role);
        u.setStatus("ACTIVE");
        return userRepository.save(u);
    }

    @Override
    @Transactional
    public User updateStaff(Long id, Map<String, Object> payload) {
        User u = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Staff not found"));
        if (payload.get("fullName") != null) u.setFullName(String.valueOf(payload.get("fullName")));
        if (payload.get("status") != null) u.setStatus(String.valueOf(payload.get("status")));
        return userRepository.save(u);
    }

    @Override
    @Transactional
    public void deleteStaff(Long id) { userRepository.deleteById(id); }

    @Override
    public List<Department> getAllDepartments() { return departmentRepository.findAll(); }

    @Override
    @Transactional
    public Department addDepartment(Map<String, Object> payload) {
        Department d = new Department();
        d.setDepartmentCode(String.format("DEPT-%02d", departmentRepository.count() + 1));
        d.setName(String.valueOf(payload.get("name")));
        d.setHeadDoctorName((String) payload.get("headDoctorName"));
        d.setLocation((String) payload.get("location"));
        d.setDescription((String) payload.get("description"));
        return departmentRepository.save(d);
    }

    @Override
    @Transactional
    public Department updateDepartment(Long id, Map<String, Object> payload) {
        Department d = departmentRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Department not found"));
        if (payload.get("name") != null) d.setName(String.valueOf(payload.get("name")));
        if (payload.get("headDoctorName") != null) d.setHeadDoctorName(String.valueOf(payload.get("headDoctorName")));
        return departmentRepository.save(d);
    }

    @Override
    @Transactional
    public void deleteDepartment(Long id) { departmentRepository.deleteById(id); }

    @Override
    public List<StaffSchedule> getAllSchedules() { return scheduleRepository.findAll(); }

    @Override
    public Map<String, Object> getBillingOverview() {
        List<Billing> bills = billingRepository.findAll();
        BigDecimal collected = bills.stream().map(Billing::getPaidAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("totalCollected", collected, "bills", bills);
    }
}
