package com.hmis.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "diagnostic_tests")
public class DiagnosticTest extends BaseEntity {

    @Column(name = "test_code", nullable = false, unique = true, length = 30)
    private String testCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private User doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id")
    private Appointment appointment;

    @Column(name = "test_name", nullable = false, length = 150)
    private String testName;

    @Column(name = "test_category", nullable = false, length = 80)
    private String testCategory;

    @Column(nullable = false, length = 20)
    private String priority = "ROUTINE";

    @Column(name = "requested_date", nullable = false)
    private LocalDate requestedDate;

    @Column(nullable = false, length = 25)
    private String status = "REQUESTED";

    @Column(name = "result_summary", length = 255)
    private String resultSummary;

    @Column(name = "report_notes", columnDefinition = "TEXT")
    private String reportNotes;

    @Column(name = "test_charge", nullable = false, precision = 10, scale = 2)
    private BigDecimal testCharge = BigDecimal.valueOf(450);

    @Column(name = "reported_at")
    private LocalDateTime reportedAt;

    public String getTestCode() { return testCode; }
    public void setTestCode(String testCode) { this.testCode = testCode; }
    public Patient getPatient() { return patient; }
    public void setPatient(Patient patient) { this.patient = patient; }
    public User getDoctor() { return doctor; }
    public void setDoctor(User doctor) { this.doctor = doctor; }
    public Appointment getAppointment() { return appointment; }
    public void setAppointment(Appointment appointment) { this.appointment = appointment; }
    public String getTestName() { return testName; }
    public void setTestName(String testName) { this.testName = testName; }
    public String getTestCategory() { return testCategory; }
    public void setTestCategory(String testCategory) { this.testCategory = testCategory; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public LocalDate getRequestedDate() { return requestedDate; }
    public void setRequestedDate(LocalDate requestedDate) { this.requestedDate = requestedDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResultSummary() { return resultSummary; }
    public void setResultSummary(String resultSummary) { this.resultSummary = resultSummary; }
    public String getReportNotes() { return reportNotes; }
    public void setReportNotes(String reportNotes) { this.reportNotes = reportNotes; }
    public BigDecimal getTestCharge() { return testCharge; }
    public void setTestCharge(BigDecimal testCharge) { this.testCharge = testCharge; }
    public LocalDateTime getReportedAt() { return reportedAt; }
    public void setReportedAt(LocalDateTime reportedAt) { this.reportedAt = reportedAt; }
}
