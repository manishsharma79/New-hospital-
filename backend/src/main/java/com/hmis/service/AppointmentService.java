package com.hmis.service;

import com.hmis.entity.Appointment;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface AppointmentService {
    Appointment scheduleAppointment(Map<String, Object> payload, String creatorEmail);
    List<Appointment> getAllAppointments();
    Appointment getAppointment(Long id);
    Appointment updateAppointment(Long id, Map<String, Object> payload);
    void deleteAppointment(Long id);
    List<Map<String, Object>> checkDoctorAvailability(LocalDate date, Long departmentId, Long doctorId);
}
