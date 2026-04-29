package com.eduhub.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eduhub.dto.AuthResponse;
import com.eduhub.dto.LoginRequest;
import com.eduhub.dto.RegisterRequest;
import com.eduhub.model.Role;
import com.eduhub.model.User;
import com.eduhub.security.JwtUtil;
import com.eduhub.service.UserService;
import com.eduhub.util.RoleResolver;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * POST /api/auth/login
     *
     * Contract:
     * - Method: POST
     * - Path: /api/auth/login
     * - Auth: Public endpoint
     * - Request body: LoginRequest { email, password }
     * - Response: AuthResponse { token, id, email, role }
     *
     * Status codes:
     * - 200 OK: credentials are valid and JWT is issued
     * - 401 Unauthorized: invalid credentials
     *
     * Why:
     * We return role and user id alongside the token so the frontend can immediately
     * build role-specific navigation without an extra round-trip to fetch profile data.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

            SecurityContextHolder.getContext().setAuthentication(authentication);

            User user = userService.findByEmail(request.getEmail()).orElseThrow();
            String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getId());
            AuthResponse response = new AuthResponse(token, user.getId(), user.getEmail(), user.getRole().name());
            return ResponseEntity.ok(response);
        } catch (org.springframework.security.core.AuthenticationException e) {
            System.err.println(">>> LOGIN ERROR: " + e.getMessage());
            return ResponseEntity.status(401).body("Invalid email or password");
        }
    }

    /**
     * POST /api/auth/register
     *
     * Contract:
     * - Method: POST
     * - Path: /api/auth/register
     * - Auth: Public endpoint
     * - Request body: RegisterRequest { email, password }
     * - Response: AuthResponse { token, id, email, role }
     *
     * Status codes:
     * - 200 OK: user registered and authenticated
     * - 400 Bad Request: duplicate email, unrecognized domain, or validation failure
     *
     * Why:
     * Role is resolved server-side from the email domain (@e-uvt.ro → STUDENT,
     * @uvt.ro → PROFESSOR). Non-university emails are rejected.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            if (userService.existsByEmail(request.getEmail())) {
                return ResponseEntity.badRequest().body("Email already exists");
            }

            // Resolve role from email domain — reject non-university emails
            Role resolvedRole = RoleResolver.fromEmail(request.getEmail());
            if (resolvedRole == null) {
                return ResponseEntity.badRequest()
                        .body("Only university emails are allowed (@e-uvt.ro for students, @uvt.ro for professors)");
            }

            User user = new User();
            user.setFirstname(request.getFirstName() != null ? request.getFirstName() : "");
            user.setLastname(request.getLastName() != null ? request.getLastName() : "");
            user.setEmail(request.getEmail());
            user.setPassword(request.getPassword());
            user.setRole(resolvedRole);

            user = userService.registerUser(user);
            String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getId());
            AuthResponse response = new AuthResponse(token, user.getId(), user.getEmail(), user.getRole().name());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            System.err.println(">>> REGISTRATION ERROR: " + e.getMessage());
            return ResponseEntity.badRequest().body("Registration failed: " + e.getMessage());
        }
    }
}