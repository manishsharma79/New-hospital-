package com.hmis.repository;

import com.hmis.entity.StaffSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StaffScheduleRepository extends JpaRepository<StaffSchedule, Long> {
    Optional<StaffSchedule> findFirstByStaffIdAndDayOfWeekAndIsAvailableTrue(Long staffId, String dayOfWeek);
    List<StaffSchedule> findByStaffId(Long staffId);
}
