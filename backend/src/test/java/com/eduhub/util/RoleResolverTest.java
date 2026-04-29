package com.eduhub.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import org.junit.jupiter.api.Test;

import com.eduhub.model.Role;

class RoleResolverTest {

    @Test
    void studentDomain_returnsStudent() {
        assertEquals(Role.STUDENT, RoleResolver.fromEmail("ion.popescu@e-uvt.ro"));
    }

    @Test
    void professorDomain_returnsProfessor() {
        assertEquals(Role.PROFESSOR, RoleResolver.fromEmail("prof.ionescu@uvt.ro"));
    }

    @Test
    void caseInsensitive_studentDomain() {
        assertEquals(Role.STUDENT, RoleResolver.fromEmail("test@E-UVT.RO"));
    }

    @Test
    void caseInsensitive_professorDomain() {
        assertEquals(Role.PROFESSOR, RoleResolver.fromEmail("test@UVT.RO"));
    }

    @Test
    void unrecognizedDomain_returnsNull() {
        assertNull(RoleResolver.fromEmail("user@gmail.com"));
    }

    @Test
    void nullEmail_returnsNull() {
        assertNull(RoleResolver.fromEmail(null));
    }

    @Test
    void noAtSign_returnsNull() {
        assertNull(RoleResolver.fromEmail("invalidemail"));
    }
}
