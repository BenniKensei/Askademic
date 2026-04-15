package com.eduhub.repository;

import com.eduhub.model.Answer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AnswerRepository extends JpaRepository<Answer, Long> {

    /**
     * Why this sort order:
     * Verified answers are surfaced first as the trusted resolution signal, while
     * ascending creation time keeps discussion flow readable inside each block.
     *
     * # FIXME: add secondary tie-breaker by id for deterministic ordering under identical timestamps.
     */
    List<Answer> findByQuestionIdOrderByVerifiedDescCreatedAtAsc(Long questionId);
}