package com.eduhub.service;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.eduhub.model.Announcement;
import com.eduhub.model.Course;
import com.eduhub.model.Role;
import com.eduhub.model.User;
import com.eduhub.repository.CourseRepository;
import com.eduhub.repository.UserRepository;
import com.eduhub.repository.AnswerRepository;
import com.eduhub.model.Answer;
import com.eduhub.model.Question;

@Component
@org.springframework.context.annotation.Profile("demo")
public class DemoDataLoader implements CommandLineRunner {

        private static final Logger logger = LoggerFactory.getLogger(DemoDataLoader.class);

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private CourseRepository courseRepository;

        @Autowired
        private QuestionService questionService;

        @Autowired
        private PasswordEncoder passwordEncoder;

        @Autowired
        private AnswerRepository answerRepository;

        @Override
        public void run(String... args) throws Exception {
                // Always check if demo data exists and create it if missing
                // This ensures new installations have sample data to work with

                // Check if admin user exists, create if not (independent of other demo data)
                if (userRepository.findByEmail("admin@uvt.ro").isEmpty()) {
                        logger.info("Creating admin user...");
                        User admin = new User(null, "Admin", "User", "admin@uvt.ro",
                                        passwordEncoder.encode("password"),
                                        Role.ADMIN);
                        userRepository.save(admin);
                        logger.info("Admin account created: admin@uvt.ro");
                }

                if (userRepository.findByEmail("prof.demo@uvt.ro").isPresent()) {
                        logger.info("Demo data already exists in database");
                        logger.info("Demo accounts: prof.demo@uvt.ro / student.demo@e-uvt.ro / admin@uvt.ro (password: 'password')");
                        return;
                }

                logger.info("=== Creating demo data ===");

                // Create users and course
                User professor = new User(null, "Professor", "Demo", "prof.demo@uvt.ro",
                                passwordEncoder.encode("password"),
                                Role.PROFESSOR);
                professor = userRepository.save(professor);

                User student = new User(null, "Student", "Demo", "student.demo@e-uvt.ro", passwordEncoder.encode("password"),
                                Role.STUDENT);
                student = userRepository.save(student);

                Course course = new Course("Computer Science 101", "Introduction to Computer Science", professor);
                course.setCourseCode("CS101DEM");
                course = courseRepository.save(course);

                course.getStudents().add(student);
                courseRepository.save(course);

                // Generate announcements (existing logic)
                generateDummyAnnouncements(course, professor);

                // Generate sample questions for testing UI
                logger.info("=== Generating sample questions for testing ===");
                generateSampleQuestions(course, student, professor);

                logger.info("Demo data created successfully!");
        }

        private List<Announcement> generateDummyAnnouncements(Course course, User professor) {
                List<Announcement> announcements = new ArrayList<>();

                // Create dummy announcements
                for (int i = 1; i <= 10; i++) {
                        Announcement ann = new Announcement(
                                        "Announcement " + i,
                                        "This is the content of announcement number " + i
                                                        + ". It contains some sample text for demonstration purposes.",
                                        course,
                                        professor);
                        announcements.add(ann);
                }

                return announcements;
        }

        private void generateSampleQuestions(Course course, User student, User professor) {
                // Group 1: Inheritance-related (should cluster together with high similarity)
                Question q1 = createQuestion("What is inheritance in OOP?",
                                "I need help understanding inheritance basics. How does it work?",
                                course, student);
                answerQuestion(q1, "Inheritance is a mechanism wherein a new class is derived from an existing class. In Java, classes may inherit or acquire the properties and methods of other classes.", professor, true);

                createQuestion("Explain inheritance in object oriented programming",
                                "How does class inheritance work? When should I use it?",
                                course, student);

                createQuestion("Difference between inheritance and composition",
                                "When should I use inheritance vs composition in my design?",
                                course, student);

                // Group 2: Polymorphism-related (should cluster together)
                Question q2 = createQuestion("Polymorphism examples in Java",
                                "Looking for real-world polymorphism examples with code",
                                course, student);
                answerQuestion(q2, "Polymorphism means 'many forms', and it occurs when we have many classes that are related to each other by inheritance. For instance, an Animal class with a makeSound() method overridden by Dog and Cat classes.", professor, true);

                createQuestion("How does polymorphism work?",
                                "Explain runtime polymorphism vs compile-time polymorphism",
                                course, professor);

                // Group 3: Unrelated questions (should be standalone)
                createQuestion("Java installation error",
                                "JDK install fails with path environment variable error",
                                course, student);

                createQuestion("How to debug in IntelliJ IDEA?",
                                "Setting breakpoints and step through debugging tutorial",
                                course, student);

                createQuestion("Maven vs Gradle build tools",
                                "Which build tool should I use for my Java project?",
                                course, professor);

                logger.info("✅ Sample questions and answers created successfully");
        }

        private Question createQuestion(String title, String content, Course course, User author) {
                Question q = questionService.createQuestionDirect(title, content, author, course, false);
                logger.info("Created question: {}", title);
                return q;
        }

        private void answerQuestion(Question question, String content, User author, boolean verified) {
                Answer a = new Answer(content, author, question);
                a.setVerified(verified);
                answerRepository.save(a);
        }
}
