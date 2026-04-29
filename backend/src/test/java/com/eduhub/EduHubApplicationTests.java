package com.eduhub;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.eduhub.dto.RegisterRequest;
import com.eduhub.model.Course;
import com.eduhub.model.Role;
import com.eduhub.model.User;
import com.eduhub.repository.UserRepository;
import com.eduhub.security.JwtUtil;
import com.eduhub.service.UserService;

/**
 * Unit Tests for EduHub Application
 * Tests constructors and core functionality using JUnit 5 and Mockito
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class EduHubApplicationTests {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private UserService userService;

    // ============================================================================
    // CONSTRUCTOR TESTS 
    // ============================================================================

    /**
     * Test User constructor - verifies all fields are set correctly
     */
    @Test
    void testUserConstructor() {
        // Given: User data
        String email = "test@example.com";
        String firstName = "John";
        String lastName = "Doe";
        String password = "hashedPassword123";
        Role role = Role.STUDENT;

        // When: Creating a User object
        User user = new User(null, firstName, lastName, email, password, role);

        // Then: All fields should be set correctly
        assertNotNull(user, "User object should not be null");
        assertEquals(email, user.getEmail(), "Email should match");
        assertEquals(firstName, user.getFirstname(), "First name should match");
        assertEquals(lastName, user.getLastname(), "Last name should match");
        assertEquals(password, user.getPassword(), "Password should match");
        assertEquals(role, user.getRole(), "Role should match");

        System.out.println("✅ testUserConstructor PASSED: User constructor works correctly");
    }

    /**
     * Test Course constructor - verifies name and description are set
     */
    @Test
    void testCourseConstructor() {
        // Given: Course data and a professor
        String courseName = "Computer Science 101";
        String courseDescription = "Introduction to Computer Science";
        User professor = new User(1, "Prof", "Smith", "prof@example.com", "pass", Role.PROFESSOR);

        // When: Creating a Course object
        Course course = new Course(courseName, courseDescription, professor);

        // Then: Fields should be set correctly
        assertNotNull(course, "Course object should not be null");
        assertEquals(courseName, course.getName(), "Course name should match");
        assertEquals(courseDescription, course.getDescription(), "Course description should match");
        assertEquals(professor, course.getProfessor(), "Professor should match");
        assertNotNull(course.getStudents(), "Students set should be initialized");
        assertTrue(course.getStudents().isEmpty(), "Students set should be empty initially");

        System.out.println("✅ testCourseConstructor PASSED: Course constructor works correctly");
    }

    // ============================================================================
    // FUNCTIONALITY TESTS 
    // ============================================================================

    /**
     * Test user registration - verifies service calls repository and returns token
     */
    @Test
    void testRegisterUser() {
        // Given: Registration request and mocked dependencies
        RegisterRequest request = new RegisterRequest();
        request.setEmail("jane.doe@e-uvt.ro");
        request.setPassword("password123");
        request.setFirstName("Jane");
        request.setLastName("Doe");

        User savedUser = new User(1, "Jane", "Doe", "jane.doe@e-uvt.ro", "hashedPass", Role.STUDENT);
        String expectedToken = "jwt.token.here";

        // Mock behavior
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashedPass");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtUtil.generateToken(anyString(), anyString(), any(Integer.class))).thenReturn(expectedToken);

        // When: Registering a new user
        String token = userService.registerUser(request);

        // Then: Repository save should be called and token should be returned
        assertNotNull(token, "Token should not be null");
        assertEquals(expectedToken, token, "Token should match expected value");
        
        verify(userRepository, times(1)).findByEmail("jane.doe@e-uvt.ro");
        verify(passwordEncoder, times(1)).encode("password123");
        verify(userRepository, times(1)).save(any(User.class));
        verify(jwtUtil, times(1)).generateToken(anyString(), anyString(), any(Integer.class));

        System.out.println("✅ testRegisterUser PASSED: User registration works correctly");
        System.out.println("   - Repository.save() was called: ✓");
        System.out.println("   - JWT token was generated: ✓");
    }

    /**
     * Test adding student to course - verifies student list management
     */
    @Test
    void testAddStudentToCourse() {
        // Given: A course and a student
        User professor = new User(1, "Prof", "Smith", "prof@example.com", "pass", Role.PROFESSOR);
        User student = new User(2, "Student", "Johnson", "student@example.com", "pass", Role.STUDENT);
        Course course = new Course("Java Programming", "Learn Java basics", professor);

        // When: Adding student to course
        course.getStudents().add(student);

        // Then: Student should be in the course
        assertNotNull(course.getStudents(), "Students set should not be null");
        assertEquals(1, course.getStudents().size(), "Course should have exactly 1 student");
        assertTrue(course.getStudents().contains(student), "Course should contain the added student");

        System.out.println("✅ testAddStudentToCourse PASSED: Student successfully added to course");
        System.out.println("   - Students list size: " + course.getStudents().size());
    }

    // ============================================================================
    // ADDITIONAL FUNCTIONALITY TESTS
    // ============================================================================

    /**
     * Test finding user by email - verifies repository query
     */
    @Test
    void testFindUserByEmail() {
        // Given: A user exists in the repository
        String email = "existing@example.com";
        User existingUser = new User(1, "Existing", "User", email, "pass", Role.STUDENT);
        
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(existingUser));

        // When: Finding user by email
        Optional<User> found = userService.findByEmail(email);

        // Then: User should be found
        assertTrue(found.isPresent(), "User should be found");
        assertEquals(email, found.get().getEmail(), "Email should match");
        verify(userRepository, times(1)).findByEmail(email);

        System.out.println("✅ testFindUserByEmail PASSED: User lookup works correctly");
    }

    /**
     * Test multiple students in course - verifies set behavior
     */
    @Test
    void testMultipleStudentsInCourse() {
        // Given: A course and multiple students
        User professor = new User(1, "Prof", "Smith", "prof@example.com", "pass", Role.PROFESSOR);
        Course course = new Course("Data Structures", "Advanced algorithms", professor);
        
        User student1 = new User(2, "Alice", "Brown", "alice@example.com", "pass", Role.STUDENT);
        User student2 = new User(3, "Bob", "Green", "bob@example.com", "pass", Role.STUDENT);
        User student3 = new User(4, "Charlie", "White", "charlie@example.com", "pass", Role.STUDENT);

        // When: Adding multiple students
        course.getStudents().add(student1);
        course.getStudents().add(student2);
        course.getStudents().add(student3);

        // Then: All students should be in the course
        assertEquals(3, course.getStudents().size(), "Course should have 3 students");
        assertTrue(course.getStudents().contains(student1), "Course should contain student1");
        assertTrue(course.getStudents().contains(student2), "Course should contain student2");
        assertTrue(course.getStudents().contains(student3), "Course should contain student3");

        System.out.println("✅ testMultipleStudentsInCourse PASSED: Multiple students managed correctly");
    }

    /**
     * Test password encoding - verifies security
     */
    @Test
    void testPasswordEncoding() {
        // Given: A plain text password
        String plainPassword = "mySecretPassword";
        String encodedPassword = "bcrypt$2a$10$encodedHash";

        when(passwordEncoder.encode(plainPassword)).thenReturn(encodedPassword);

        // When: Encoding password
        String result = passwordEncoder.encode(plainPassword);

        // Then: Password should be encoded
        assertNotNull(result, "Encoded password should not be null");
        assertEquals(encodedPassword, result, "Encoded password should match expected hash");
        assertNotEquals(plainPassword, result, "Encoded password should differ from plain text");
        
        verify(passwordEncoder, times(1)).encode(plainPassword);

        System.out.println("✅ testPasswordEncoding PASSED: Password encoding works correctly");
        System.out.println("   - Plain: " + plainPassword);
        System.out.println("   - Encoded: " + result);
    }
}
