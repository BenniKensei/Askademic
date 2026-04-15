package com.eduhub.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eduhub.dto.CourseRequest;
import com.eduhub.model.Course;
import com.eduhub.model.User;
import com.eduhub.service.CourseService;
import com.eduhub.service.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    @Autowired
    private CourseService courseService;

    @Autowired
    private UserService userService;

    /**
     * POST /api/courses
     *
     * Contract:
     * - Auth: PROFESSOR
     * - Request body: CourseRequest { name, description }
     * - Response: Course
     * - Status: 200, 401, 403, 404
     *
     * Why:
     * Course ownership is attached at creation time so downstream authorization checks
     * remain simple and deterministic for grading, announcements, and moderation.
     */
    @PostMapping
    @PreAuthorize("hasAuthority('PROFESSOR')")
    public ResponseEntity<?> createCourse(@Valid @RequestBody CourseRequest request, Authentication authentication) {
        String email = authentication.getName();
        User professor = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Course course = new Course();
        course.setName(request.getName());
        course.setDescription(request.getDescription());
        course.setProfessor(professor);
        Course saved = courseService.createCourse(course);
        return ResponseEntity.ok(saved);
    }

    /**
     * GET /api/courses
     *
     * Contract:
     * - Auth: authenticated user
     * - Response: List<Course>
     * - Status: 200, 401
     */
    @GetMapping
    public ResponseEntity<List<Course>> getAllCourses() {
        List<Course> courses = courseService.getAllCourses();
        return ResponseEntity.ok(courses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Course> getCourseById(@PathVariable Integer id) {
        Course course = courseService.getCourseById(id)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        return ResponseEntity.ok(course);
    }

    /**
     * GET /api/courses/professor
     *
     * Contract:
     * - Auth: PROFESSOR
     * - Response: List<Course> owned by current professor
     * - Status: 200, 401, 403, 404
     */
    @GetMapping("/professor")
    @PreAuthorize("hasAuthority('PROFESSOR')")
    public ResponseEntity<List<Course>> getProfessorCourses(Authentication authentication) {
        String email = authentication.getName();
        User professor = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<Course> courses = courseService.getCoursesByProfessor(professor.getId());
        return ResponseEntity.ok(courses);
    }

    /**
     * POST /api/courses/{id}/enroll
     *
     * Contract:
     * - Auth: STUDENT
     * - Response: success message
     * - Status: 200, 401, 403, 404
     */
    @PostMapping("/{id}/enroll")
    @PreAuthorize("hasAuthority('STUDENT')")
    public ResponseEntity<String> enrollStudent(@PathVariable Integer id, Authentication authentication) {
        String email = authentication.getName();
        User student = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        courseService.enrollStudent(id, student.getId());
        return ResponseEntity.ok("Enrolled successfully");
    }

    /**
     * GET /api/courses/student
     *
     * Contract:
     * - Auth: STUDENT
     * - Response: List<Course> where current student is enrolled
     * - Status: 200, 401, 403, 404
     */
    @GetMapping("/student")
    @PreAuthorize("hasAuthority('STUDENT')")
    public ResponseEntity<List<Course>> getStudentCourses(Authentication authentication) {
        String email = authentication.getName();
        User student = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<Course> courses = courseService.getCoursesByStudent(student.getId());
        return ResponseEntity.ok(courses);
    }

    /**
     * PUT /api/courses/{id}/grading
     *
     * Contract:
     * - Auth: PROFESSOR
     * - Request body: raw grading guide text
     * - Response: updated Course
     * - Status: 200, 401, 403, 404
     *
     * Why:
     * This explicit ownership check prevents professors from modifying grading policies
     * for courses they do not own even if they hold a global PROFESSOR role.
     */
    @PutMapping("/{id}/grading")
    @PreAuthorize("hasAuthority('PROFESSOR')")
    public ResponseEntity<Course> updateGradingInfo(
            @PathVariable Integer id,
            @RequestBody String gradingInfo,
            Authentication authentication) {
        String email = authentication.getName();
        User professor = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Course course = courseService.getCourseById(id)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        
        // Verify professor owns this course
        if (!course.getProfessor().getId().equals(professor.getId())) {
            return ResponseEntity.status(403).build();
        }
        
        course.setGradingInfo(gradingInfo);
        Course updated = courseService.createCourse(course);
        return ResponseEntity.ok(updated);
    }

    /**
     * POST /api/courses/enroll-by-code
     *
     * Contract:
     * - Auth: STUDENT
     * - Request body: plain string courseCode
     * - Response: success message
     * - Status: 200, 400, 401, 403, 404
     */
    @PostMapping("/enroll-by-code")
    @PreAuthorize("hasAuthority('STUDENT')")
    public ResponseEntity<String> enrollByCode(@RequestBody String courseCode, Authentication authentication) {
        String email = authentication.getName();
        User student = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        courseService.enrollStudentByCode(courseCode.trim(), student.getId());
        return ResponseEntity.ok("Enrolled successfully");
    }

    /**
     * DELETE /api/courses/{id}
     *
     * Contract:
     * - Auth: PROFESSOR or ADMIN
     * - Response: no body
     * - Status: 200, 401, 403, 404
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PROFESSOR', 'ADMIN')")
    public ResponseEntity<Void> deleteCourse(
            @PathVariable Integer id,
            @AuthenticationPrincipal User user) {
        courseService.deleteCourse(id, user);
        return ResponseEntity.ok().build();
    }
}