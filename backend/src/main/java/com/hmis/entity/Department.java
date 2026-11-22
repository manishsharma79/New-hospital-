package com.hmis.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "departments")
public class Department extends BaseEntity {

    @Column(name = "department_code", nullable = false, unique = true, length = 30)
    private String departmentCode;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(name = "head_doctor_name", length = 120)
    private String headDoctorName;

    @Column(length = 120)
    private String location;

    @Column(name = "phone_ext", length = 20)
    private String phoneExt;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @OneToMany(mappedBy = "department", fetch = FetchType.LAZY)
    private List<User> staffMembers = new ArrayList<>();

    public String getDepartmentCode() { return departmentCode; }
    public void setDepartmentCode(String departmentCode) { this.departmentCode = departmentCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getHeadDoctorName() { return headDoctorName; }
    public void setHeadDoctorName(String headDoctorName) { this.headDoctorName = headDoctorName; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getPhoneExt() { return phoneExt; }
    public void setPhoneExt(String phoneExt) { this.phoneExt = phoneExt; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<User> getStaffMembers() { return staffMembers; }
    public void setStaffMembers(List<User> staffMembers) { this.staffMembers = staffMembers; }
}
