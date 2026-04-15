package com.eduhub.repository;

import com.eduhub.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {

    /**
     * Default feed ordering favors newest classroom activity first.
     */
    List<Question> findByCourseIdOrderByCreatedAtDesc(Integer courseId);

    /**
     * Why custom JPQL:
     * Uses collection cardinality to avoid fetching answers just to compute unanswered
     * status in Java service code.
     */
    @Query("SELECT q FROM Question q WHERE q.course.id = :courseId AND SIZE(q.answers) = 0 ORDER BY q.createdAt DESC")
    List<Question> findUnansweredQuestionsByCourseId(Integer courseId);

    /**
     * Complement of unanswered query; kept explicit for readability and SQL planner
     * stability across Hibernate versions.
     *
     * # TODO: benchmark EXISTS-based variant if answer volume grows significantly.
     */
    @Query("SELECT q FROM Question q WHERE q.course.id = :courseId AND SIZE(q.answers) > 0 ORDER BY q.createdAt DESC")
    List<Question> findAnsweredQuestionsByCourseId(Integer courseId);
}