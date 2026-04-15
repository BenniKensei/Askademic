-- Assignment: University Course Management System
-- Database: PostgreSQL

-- First, let's clear out old tables/views so we can re-run this script without errors.
DROP VIEW IF EXISTS TranscriptView;
DROP VIEW IF EXISTS CoursePerformanceView;
DROP TABLE IF EXISTS Enrollments;
DROP TABLE IF EXISTS Courses;
DROP TABLE IF EXISTS AppUsers;

-- ---------------------------------------------------------
-- CREATING TABLES (Normalized to 3NF)
-- ---------------------------------------------------------

-- AppUsers
-- I'm putting Students and Professors in the same table to keep it simple.
-- The 'role' column differentiates them.
CREATE TABLE AppUsers (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'PROFESSOR')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses
-- Standard table for the classes available.
-- Note: The foreign key here just checks if the user exists. Ideally, we'd make sure 
-- the ID belongs specifically to a 'PROFESSOR', but standard SQL FKs don't support 
-- that filter directly. Good enough for this assignment.
CREATE TABLE Courses (
    course_id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    credits INT CHECK (credits > 0),
    professor_id INT NOT NULL,
    CONSTRAINT fk_course_professor 
        FOREIGN KEY (professor_id) 
        REFERENCES AppUsers(user_id)
        ON DELETE SET NULL 
);

-- Enrollments
-- Linking table for Students <-> Courses.
-- We need the unique constraint so a student can't take the same class twice at once.
CREATE TABLE Enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    grade DECIMAL(4, 2) CHECK (grade >= 1.00 AND grade <= 10.00), -- Grades 1-10
    enrollment_date DATE DEFAULT CURRENT_DATE,
    
    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id)
        REFERENCES AppUsers(user_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_enrollment_course
        FOREIGN KEY (course_id)
        REFERENCES Courses(course_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_student_course UNIQUE (student_id, course_id)
);

-- ---------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------

-- View 1: TranscriptView
-- Makes it easier to read the grades without writing joins every time.
CREATE OR REPLACE VIEW TranscriptView AS
SELECT 
    u.full_name AS StudentName,
    u.email AS StudentEmail,
    c.title AS CourseTitle,
    e.grade AS Grade,
    e.enrollment_date
FROM Enrollments e
JOIN AppUsers u ON e.student_id = u.user_id
JOIN Courses c ON e.course_id = c.course_id
WHERE u.role = 'STUDENT';

-- View 2: CoursePerformanceView
-- Quick stats to check the average grade for each course.
CREATE OR REPLACE VIEW CoursePerformanceView AS
SELECT 
    c.title AS Course,
    p.full_name AS Professor,
    COUNT(e.student_id) AS EnrolledCount,
    AVG(e.grade) AS AverageGrade
FROM Courses c
JOIN AppUsers p ON c.professor_id = p.user_id
LEFT JOIN Enrollments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.title, p.full_name;

-- ---------------------------------------------------------
-- ADDING SAMPLE DATA
-- ---------------------------------------------------------

-- Adding Users (Students and Profs)
INSERT INTO AppUsers (full_name, email, role) VALUES 
('Alice Smith', 'alice@student.edu', 'STUDENT'),
('Bob Jones', 'bob@student.edu', 'STUDENT'),
('Charlie Brown', 'charlie@student.edu', 'STUDENT'),
('Dr. Emily White', 'emily@prof.edu', 'PROFESSOR'),
('Dr. Alan Grant', 'alan@prof.edu', 'PROFESSOR');

-- Adding Courses
-- I'm assuming the Prof IDs are 4 and 5 based on the insert order above.
-- In a real app, I'd query the IDs first, but hardcoding is fine for testing.
INSERT INTO Courses (title, description, credits, professor_id) VALUES 
('Database Systems', 'Intro to SQL and Normalization', 6, 4),
('Paleontology 101', 'Study of ancient life', 4, 5),
('Advanced Algorithms', 'Complexity theory', 6, 4);

-- Adding Enrollments
INSERT INTO Enrollments (student_id, course_id, grade, enrollment_date) VALUES 
(1, 1, 9.5, '2023-10-01'), -- Alice in DB
(1, 2, 8.0, '2023-10-02'), -- Alice in Paleo
(2, 1, 7.5, '2023-10-01'), -- Bob in DB
(3, 3, 10.0, '2023-10-05'); -- Charlie in Algos

-- ---------------------------------------------------------
-- TESTING UPDATES AND DELETES
-- ---------------------------------------------------------

-- Alice retook the exam, so let's update her grade to a 10.
UPDATE Enrollments
SET grade = 10.0
WHERE student_id = 1 AND course_id = 1;

-- Bob dropped out. 
-- Since we used ON DELETE CASCADE above, deleting him from AppUsers 
-- will automatically wipe his records from the Enrollments table too.
DELETE FROM AppUsers
WHERE email = 'bob@student.edu';

-- Check if everything looks right
SELECT * FROM TranscriptView;
SELECT * FROM CoursePerformanceView;