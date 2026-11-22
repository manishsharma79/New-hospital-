package com.hmis.service.impl;

import com.hmis.entity.*;
import com.hmis.enums.AppointmentStatus;
import com.hmis.enums.RoleName;
import com.hmis.exception.BusinessRuleException;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.*;
import com.hmis.service.AppointmentService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AppointmentServiceImpl implements AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final StaffScheduleRepository scheduleRepository;

    public AppointmentServiceImpl(AppointmentRepository appointmentRepository, PatientRepository patientRepository,
                                  UserRepository userRepository, DepartmentRepository departmentRepository,
                                  StaffScheduleRepository scheduleRepository) {
        this.appointmentRepository = appointmentRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.scheduleRepository = scheduleRepository;
    }

    @Override
    @Transactional
    public Appointment scheduleAppointment(Map<String, Object> payload, String creatorEmail) {
        Long patientId = Long.valueOf(String.valueOf(payload.get("patientId")));
        Long doctorId = Long.valueOf(String.valueOf(payload.get("doctorId")));
        Long deptId = Long.valueOf(String.valueOf(payload.get("departmentId")));
        LocalDate date = LocalDate.parse(String.valueOf(payload.get("appointmentDate")));
        String slot = String.valueOf(payload.get("timeSlot")).trim();

        if (appointmentRepository.existsByDoctorIdAndAppointmentDateAndTimeSlotAndStatusNot(
                doctorId, date, slot, AppointmentStatus.CANCELLED)) {
            throw new BusinessRuleException("Double-booking prevented: time slot already booked", HttpStatus.CONFLICT);
        }

        Appointment appt = new Appointment();
        appt.setAppointmentCode(String.format("APT-2026-%04d", appointmentRepository.count() + 1));
        appt.setPatient(patientRepository.findById(patientId).orElseThrow(() -> new ResourceNotFoundException("Patient not found")));
        appt.setDoctor(userRepository.findById(doctorId).orElseThrow(() -> new ResourceNotFoundException("Doctor not found")));
        appt.setDepartment(departmentRepository.findById(deptId).orElseThrow(() -> new ResourceNotFoundException("Department not found")));
        appt.setAppointmentDate(date);
        appt.setTimeSlot(slot);
        appt.setVisitType(payload.get("visitType") != null ? String.valueOf(payload.get("visitType")) : "Consultation");
        appt.setReason((String) payload.get("reason"));
        appt.setStatus(AppointmentStatus.SCHEDULED);
        userRepository.findByEmailIgnoreCase(creatorEmail).ifPresent(appt::setCreatedBy);

        return appointmentRepository.save(appt);
    }

    @Override
    public List<Appointment> getAllAppointments() {
        return appointmentRepository.findAll();
    }

    @Override
    public Appointment getAppointment(Long id) {
        return appointmentRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
    }

    @Override
    @Transactional
    public Appointment updateAppointment(Long id, Map<String, Object> payload) {
        Appointment appt = getAppointment(id);
        if (payload.get("status") != null) {
            appt.setStatus(AppointmentStatus.valueOf(String.valueOf(payload.get("status")).toUpperCase()));
        }
        return appointmentRepository.save(appt);
    }

    @Override
    @Transactional
    public void deleteAppointment(Long id) {
        appointmentRepository.deleteById(id);
    }

    @Override
    public List<Map<String, Object>> checkDoctorAvailability(LocalDate date, Long departmentId, Long doctorId) {
        String dayName = date.getDayOfWeek().name();
        List<User> doctors = userRepository.findByRole_NameAndStatus(RoleName.DOCTOR, "ACTIVE").stream()
                .filter(d -> departmentId == null || (d.getDepartment() != null && d.getDepartment().getId().equals(departmentId)))
                .filter(d -> doctorId == null || d.getId().equals(doctorId))
                .collect(Collectors.toList());

        List<Map<String, Object>> results = new ArrayList<>();
        for (User doc : doctors) {
            Optional<StaffSchedule> schedOpt = scheduleRepository.findFirstByStaffIdAndDayOfWeekAndIsAvailableTrue(doc.getId(), dayName);
            List<String> openSlots = new ArrayList<>();
            if (schedOpt.isPresent()) {
                StaffSchedule s = schedOpt.get();
                Set<String> booked = appointmentRepository
                        .findByDoctorIdAndAppointmentDateAndStatusNot(doc.getId(), date, AppointmentStatus.CANCELLED)
                        .stream()
                        .map(Appointment::getTimeSlot)
                        .collect(Collectors.toSet());

                LocalTime cursor = LocalTime.parse(s.getStartTime());
                LocalTime end = LocalTime.parse(s.getEndTime());
                while (!cursor.plusMinutes(s.getSlotDurationMinutes()).isAfter(end)) {
                    String slotStr = cursor.toString().substring(0, 5);
                    if (!booked.contains(slotStr)) {
                        openSlots.add(slotStr);
                    }
                    cursor = cursor.plusMinutes(s.getSlotDurationMinutes());
                }
            }
            results.add(Map.of(
                    "doctorId", doc.getId(),
                    "doctorName", doc.getFullName(),
                    "date", date.toString(),
                    "availableSlots", openSlots,
                    "isAvailable", !openSlots.isEmpty()
            ));
        }
        return results;
    }
}
