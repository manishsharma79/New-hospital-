package com.hmis.service.impl;

import com.hmis.config.JwtService;
import com.hmis.entity.Role;
import com.hmis.entity.User;
import com.hmis.enums.RoleName;
import com.hmis.exception.BusinessRuleException;
import com.hmis.exception.ResourceNotFoundException;
import com.hmis.repository.RoleRepository;
import com.hmis.repository.UserRepository;
import com.hmis.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthServiceImpl(UserRepository userRepository, RoleRepository roleRepository,
                           PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Override
    public Map<String, Object> login(String email, String password) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessRuleException("Invalid email or password", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessRuleException("Invalid email or password", HttpStatus.UNAUTHORIZED);
        }
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new BusinessRuleException("Account is inactive", HttpStatus.FORBIDDEN);
        }

        String token = jwtService.generateToken(user);
        return Map.of(
                "token", token,
                "tokenType", "Bearer",
                "user", toUserMap(user)
        );
    }

    @Override
    @Transactional
    public Map<String, Object> registerStaff(Map<String, Object> request) {
        String email = String.valueOf(request.get("email")).trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BusinessRuleException("Email already registered", HttpStatus.CONFLICT);
        }
        RoleName roleName = RoleName.valueOf(String.valueOf(request.get("roleName")).trim().toUpperCase());
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        User user = new User();
        user.setStaffCode("STF-" + (userRepository.count() + 1));
        user.setFullName(String.valueOf(request.get("fullName")).trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(String.valueOf(request.get("password"))));
        user.setRole(role);
        user.setStatus("ACTIVE");
        User saved = userRepository.save(user);
        return toUserMap(saved);
    }

    @Override
    public Map<String, Object> getCurrentUser(String email) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toUserMap(user);
    }

    @Override
    public void logout(String token) {
        jwtService.revokeToken(token);
    }

    private Map<String, Object> toUserMap(User u) {
        return Map.of(
                "id", u.getId(),
                "staffCode", u.getStaffCode(),
                "fullName", u.getFullName(),
                "email", u.getEmail(),
                "role", u.getRole().getName().name()
        );
    }
}
