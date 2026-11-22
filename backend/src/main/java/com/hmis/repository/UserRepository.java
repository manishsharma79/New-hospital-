package com.hmis.repository;

import com.hmis.entity.User;
import com.hmis.enums.RoleName;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    List<User> findByRole_NameAndStatus(RoleName roleName, String status);
    List<User> findByDepartmentIdAndRole_Name(Long departmentId, RoleName roleName);
    long countByRole_NameAndStatus(RoleName roleName, String status);
}
