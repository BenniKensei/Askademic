package com.eduhub.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter, AuthenticationProvider authenticationProvider) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.authenticationProvider = authenticationProvider;
        logger.info("Security configuration initialized successfully - JWT filter and auth provider configured");
    }

    /**
     * Defines stateless JWT-based request security.
     *
     * Why:
     * - CSRF is disabled because the API does not rely on cookie-based sessions.
     * - Stateless sessions simplify horizontal scaling and avoid server-side session drift.
     * - Auth routes stay public so clients can bootstrap tokens.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 1. DISABLE CSRF (Crucial for 403 fix)
            .csrf(AbstractHttpConfigurer::disable)
            
            // 2. SETUP CORS (using CorsConfig bean)
            .cors(Customizer.withDefaults())
            
            // 3. DEFINE PERMISSIONS
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()  // Open Login/Register
                .requestMatchers("/h2-console/**").permitAll() // Open Database
                .anyRequest().authenticated()                  // Lock everything else
            )
            
            // 4. STATELESS SESSION (No Cookies)
            .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // 5. AUTH PROVIDER & FILTER
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        // # TODO: tighten permitAll routes when an actuator or API-doc profile is introduced.
        // # FIXME: add centralized security event audit trail for repeated auth failures.

        return http.build();
    }
}