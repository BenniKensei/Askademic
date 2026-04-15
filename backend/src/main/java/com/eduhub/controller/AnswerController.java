package com.eduhub.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eduhub.dto.AnswerRequest;
import com.eduhub.model.Answer;
import com.eduhub.model.Question;
import com.eduhub.model.User;
import com.eduhub.repository.AnswerRepository;
import com.eduhub.repository.QuestionRepository;
import com.eduhub.repository.UserRepository;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/answers")
public class AnswerController {

    /**
     * Request DTO for batch answering multiple questions at once.
     * Used by professors to answer grouped similar questions efficiently.
     */
    public static class BatchAnswerRequest {
        private List<Long> questionIds;
        private String content;
        private boolean autoVerify;
        private boolean anonymous;

        public List<Long> getQuestionIds() {
            return questionIds;
        }

        public void setQuestionIds(List<Long> questionIds) {
            this.questionIds = questionIds;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public boolean isAutoVerify() {
            return autoVerify;
        }

        public void setAutoVerify(boolean autoVerify) {
            this.autoVerify = autoVerify;
        }

        public boolean isAnonymous() {
            return anonymous;
        }

        public void setAnonymous(boolean anonymous) {
            this.anonymous = anonymous;
        }
    }

    private final AnswerRepository answerRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public AnswerController(AnswerRepository answerRepository,
            QuestionRepository questionRepository,
            UserRepository userRepository) {
        this.answerRepository = answerRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    /**
     * GET /api/answers/question/{questionId}
     *
     * Contract:
     * - Auth: PROFESSOR or STUDENT
     * - Response: List<Answer> ordered by verified desc then createdAt asc
     * - Status: 200, 401, 403
     *
     * Why:
     * Verified answers are prioritized so students see instructor-approved guidance first,
     * while chronological order preserves discussion context.
     */
    @GetMapping("/question/{questionId}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<List<Answer>> getAnswersByQuestion(@PathVariable Long questionId) {
        List<Answer> answers = answerRepository.findByQuestionIdOrderByVerifiedDescCreatedAtAsc(questionId);
        return ResponseEntity.ok(answers);
    }

    /**
     * POST /api/answers
     *
     * Contract:
     * - Auth: PROFESSOR or STUDENT
     * - Request body: AnswerRequest { questionId, content, anonymous }
     * - Response: Answer
     * - Status: 200, 400, 401, 403, 404
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<Answer> createAnswer(
            @Valid @RequestBody AnswerRequest request,
            @AuthenticationPrincipal User user) {

        Question question = questionRepository.findById(Objects.requireNonNull(request.getQuestionId()))
                .orElseThrow(() -> new RuntimeException("Question not found"));

        User author = userRepository.findById(Objects.requireNonNull(user.getId()))
                .orElseThrow(() -> new RuntimeException("User not found"));

        Answer answer = new Answer(request.getContent(), author, question);
        answer.setAnonymous(request.isAnonymous());
        // # TODO: add mention/notification fan-out when answers are posted by professors.
        return ResponseEntity.ok(answerRepository.save(answer));
    }

    /**
     * POST /api/answers/batch
     * Creates the same answer for multiple questions at once.
     * Used by professors to efficiently answer grouped similar questions.
     * 
     * @param request BatchAnswerRequest containing questionIds, content,
     *                autoVerify, anonymous
     * @param user    The authenticated professor
     * @return List of created answers
     */
    @PostMapping("/batch")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<List<Answer>> createBatchAnswers(
            @RequestBody BatchAnswerRequest request,
            @AuthenticationPrincipal User user) {

        if (request.getQuestionIds() == null || request.getQuestionIds().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        User author = userRepository.findById(Objects.requireNonNull(user.getId()))
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Answer> createdAnswers = new ArrayList<>();

        for (Long questionId : request.getQuestionIds()) {
            if (questionId == null)
                continue;
            Question question = questionRepository.findById(questionId)
                    .orElse(null);

            if (question == null) {
                continue; // Skip invalid question IDs
            }

            // Verify professor teaches this course
            if (!question.getCourse().getProfessor().getId().equals(user.getId())) {
                continue; // Skip questions from courses the professor doesn't teach
            }

            Answer answer = new Answer(request.getContent(), author, question);
            answer.setAnonymous(request.isAnonymous());

            // Auto-verify if requested (professor's own answer)
            if (request.isAutoVerify()) {
                answer.setVerified(true);
            }

            createdAnswers.add(answerRepository.save(answer));
        }

        // # FIXME: report partial success details (invalid IDs and unauthorized IDs) to improve UX.
        return ResponseEntity.ok(createdAnswers);
    }

    /**
     * PUT /api/answers/{id}/verify
     *
     * Contract:
     * - Auth: PROFESSOR
     * - Response: Answer with toggled verified flag
     * - Status: 200, 401, 403, 404
     */
    @PutMapping("/{id}/verify")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Answer> verifyAnswer(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        Answer answer = answerRepository.findById(Objects.requireNonNull(id))
                .orElseThrow(() -> new RuntimeException("Answer not found"));

        // Verify the professor teaches this course
        Question question = answer.getQuestion();
        if (!question.getCourse().getProfessor().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        answer.setVerified(!answer.isVerified());
        return ResponseEntity.ok(answerRepository.save(answer));
    }

    /**
     * DELETE /api/answers/{id}
     *
     * Contract:
     * - Auth: PROFESSOR, STUDENT, or ADMIN
     * - Response: no body
     * - Status: 200, 401, 403, 404
     *
     * Why:
     * We remove the answer from the in-memory parent collection before delete to prevent
     * stale managed entities from re-persisting the row through cascading updates.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT', 'ADMIN')")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> deleteAnswer(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        Answer answer = answerRepository.findById(Objects.requireNonNull(id))
                .orElseThrow(() -> new RuntimeException("Answer not found"));

        // Permission check: Author OR Course Professor OR Admin
        boolean isAuthor = answer.getAuthor().getId().equals(user.getId());
        boolean isAdmin = user.getRole().name().equals("ADMIN");
        boolean isCourseProfessor = answer.getQuestion().getCourse().getProfessor().getId().equals(user.getId());

        if (!isAuthor && !isCourseProfessor && !isAdmin) {
            return ResponseEntity.status(403).build();
        }

        // Prevent resurrection by CascadeType.ALL/MERGE from parent Question
        Question question = answer.getQuestion();
        if (question != null) {
            question.getAnswers().removeIf(a -> a.getId().equals(id));
            // We don't save question explicitly, but if it's managed, this updates the
            // collection
        }

        answerRepository.delete(answer);
        answerRepository.flush();
        return ResponseEntity.ok().build();
    }
}
