package com.eduhub.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.eduhub.dto.RegisterRequest;
import com.eduhub.model.Role;
import com.eduhub.model.User;
import com.eduhub.repository.UserRepository;
import com.eduhub.security.JwtUtil;
import com.eduhub.util.RoleResolver;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    // Extract first and last name from university email
    private String[] extractNamesFromEmail(String email) {
        String[] names = new String[2];
        try {
            // Extract local part before @
            String localPart = email.substring(0, email.indexOf('@'));
            // Split by dot or underscore
            String[] parts = localPart.split("[._-]");
            if (parts.length >= 2) {
                // Capitalize first letter of each name
                names[0] = capitalize(parts[0]);
                names[1] = capitalize(parts[1]);
            } else {
                names[0] = capitalize(parts[0]);
                names[1] = "";
            }
        } catch (Exception e) {
            names[0] = email.substring(0, email.indexOf('@'));
            names[1] = "";
        }
        return names;
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    public User registerUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    public String registerUser(RegisterRequest request) {
        // Check if user already exists
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("User already exists");
        }

        // Resolve role from email domain
        Role resolvedRole = RoleResolver.fromEmail(request.getEmail());
        if (resolvedRole == null) {
            throw new RuntimeException("Only university emails are allowed (@e-uvt.ro for students, @uvt.ro for professors)");
        }

        // Extract names from email if not provided
        String firstName = request.getFirstName();
        String lastName = request.getLastName();
        if ((firstName == null || firstName.isEmpty()) && request.getEmail() != null) {
            String[] names = extractNamesFromEmail(request.getEmail());
            firstName = names[0];
            lastName = names[1];
        }

        // Create new user
        User user = new User(
            null,
            firstName,
            lastName,
            request.getEmail(),
            passwordEncoder.encode(request.getPassword()),
            resolvedRole
        );

        // Save user
        User savedUser = userRepository.save(user);

        // Generate and return JWT token
        return jwtUtil.generateToken(savedUser.getEmail(), savedUser.getRole().name(), savedUser.getId());
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean existsByEmail(String email) {
        return userRepository.findByEmail(email).isPresent();
    }
}