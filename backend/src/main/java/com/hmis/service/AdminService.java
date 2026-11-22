package com.hmis.service;

import com.hmis.entity.Department;
import com.hmis.entity.StaffSchedule;
import com.hmis.entity.User;
import java.util.List;
import java.util.Map;

public interface AdminService {
    Map<String, Object> getDashboardStats();
    List<User> getAllStaff();
    User addStaff(Map<String, Object> payload);
    User updateStaff(Long id, Map<String, Object> payload);
    void deleteStaff(Long id);
    List<Department> getAllDepartments();
    Department addDepartment(Map<String, Object> payload);
    Department updateDepartment(Long id, Map<String, Object> payload);
    void deleteDepartment(Long id);
    List<StaffSchedule> getAllSchedules();
    Map<String, Object> getBillingOverview();
}
