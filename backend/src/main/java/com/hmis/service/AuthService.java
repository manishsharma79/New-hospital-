package com.hmis.service;

import java.util.Map;

public interface AuthService {
    Map<String, Object> login(String email, String password);
    Map<String, Object> registerStaff(Map<String, Object> request);
    Map<String, Object> getCurrentUser(String email);
    void logout(String token);
}
