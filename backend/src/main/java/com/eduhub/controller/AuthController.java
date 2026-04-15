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
     * - Request body: RegisterRequest { firstName, lastName, email, password, role }
     * - Response: AuthResponse { token, id, email, role }
     *
     * Status codes:
     * - 200 OK: user registered and authenticated
     * - 400 Bad Request: duplicate email, invalid role, or validation failure
     *
     * Why:
     * Registration directly issues a JWT to minimize onboarding friction and reduce
     * drop-off between account creation and first authenticated action.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            if (userService.existsByEmail(request.getEmail())) {
                return ResponseEntity.badRequest().body("Email already exists");
            }

            User user = new User();
            user.setFirstname(request.getFirstName() != null ? request.getFirstName() : "");
            user.setLastname(request.getLastName() != null ? request.getLastName() : "");
            user.setEmail(request.getEmail());
            user.setPassword(request.getPassword());
            user.setRole(Role.valueOf(request.getRole().toUpperCase()));

            user = userService.registerUser(user);
            String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getId());
            AuthResponse response = new AuthResponse(token, user.getId(), user.getEmail(), user.getRole().name());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            System.err.println(">>> REGISTRATION ERROR: Invalid role - " + e.getMessage());
            return ResponseEntity.badRequest().body("Registration failed: Invalid role");
        } catch (RuntimeException e) {
            System.err.println(">>> REGISTRATION ERROR: " + e.getMessage());
            return ResponseEntity.badRequest().body("Registration failed: " + e.getMessage());
        }
    }
}