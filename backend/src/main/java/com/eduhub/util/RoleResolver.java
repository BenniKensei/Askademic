package com.eduhub.util;

import com.eduhub.model.Role;

/**
 * Resolves user role from their university email domain.
 *
 * Mapping:
 *   @e-uvt.ro  → STUDENT
 *   @uvt.ro    → PROFESSOR
 *
 * Emails from unrecognized domains are rejected (returns null).
 */
public final class RoleResolver {

    private RoleResolver() {}

    /**
     * Determines the {@link Role} based on the email domain.
     *
     * @param email the user's email address
     * @return the resolved role, or {@code null} if the domain is not recognized
     */
    public static Role fromEmail(String email) {
        if (email == null || !email.contains("@")) {
            return null;
        }

        String domain = email.substring(email.indexOf('@') + 1).toLowerCase();

        if (domain.equals("e-uvt.ro")) {
            return Role.STUDENT;
        }
        if (domain.equals("uvt.ro")) {
            return Role.PROFESSOR;
        }

        // Unrecognized domain — caller should reject the registration
        return null;
    }
}
