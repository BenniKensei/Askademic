package com.eduhub.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.eduhub.model.Answer;

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