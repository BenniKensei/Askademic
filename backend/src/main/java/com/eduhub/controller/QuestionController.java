package com.eduhub.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.eduhub.dto.QuestionGroupDto;
import com.eduhub.dto.QuestionRequest;
import com.eduhub.model.Question;
import com.eduhub.model.User;
import com.eduhub.service.QuestionService;

import jakarta.validation.Valid;

/**
 * REST controller for course question flows.
 *
 * Why:
 * The controller remains thin on purpose and delegates domain rules to
 * QuestionService so authorization and grouping logic stay testable in one place.
 */
@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private final QuestionService questionService;

    public QuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    /**
     * GET /api/questions/course/{courseId}
     *
     * Contract:
     * - Auth: PROFESSOR or STUDENT
     * - Query: optional filter in {answered, unanswered}
     * - Response: List<Question>
     * - Status: 200, 401, 403
     */
    @GetMapping("/course/{courseId}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<List<Question>> getQuestionsByCourse(
            @PathVariable Integer courseId,
            @RequestParam(required = false) String filter) {
        
        List<Question> questions = questionService.getQuestionsByCourse(courseId, filter);
        return ResponseEntity.ok(questions);
    }

    /**
     * POST /api/questions
     *
     * Contract:
     * - Auth: PROFESSOR or STUDENT
     * - Request body: QuestionRequest { title, content, courseId, anonymous }
     * - Response: Question
     * - Status: 200, 400, 401, 403, 404
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<Question> createQuestion(
            @Valid @RequestBody QuestionRequest request,
            @AuthenticationPrincipal User user) {
        
        Question savedQuestion = questionService.createQuestion(request, user);
        return ResponseEntity.ok(savedQuestion);
    }

    /**
     * DELETE /api/questions/{id}
     *
     * Contract:
     * - Auth: PROFESSOR or STUDENT
     * - Response: no body
     * - Status: 200, 401, 403, 404
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<Void> deleteQuestion(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        
        questionService.deleteQuestion(id, user);
        return ResponseEntity.ok().build();
    }
    
    /**
     * GET /api/questions/grouped/{courseId}
     *
     * Contract:
     * - Auth: PROFESSOR or STUDENT
     * - Query: threshold (0.0-1.0), default 0.1
     * - Response: List<QuestionGroupDto>
     * - Status: 200, 400, 401, 403
     *
     * Why:
     * Threshold stays configurable so professors can trade precision for recall based
     * on class size and expected wording variation.
     */
    @GetMapping("/grouped/{courseId}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<List<QuestionGroupDto>> getGroupedQuestions(
            @PathVariable Integer courseId,
            @RequestParam(required = false, defaultValue = "0.1") double threshold) {
        
        // Validate threshold range
        if (threshold < 0.0 || threshold > 1.0) {
            throw new IllegalArgumentException("Threshold must be between 0.0 and 1.0");
        }

        // # TODO: expose the threshold default from configuration to avoid hard-coding in API docs.
        // # FIXME: return a structured validation payload instead of bubbling IllegalArgumentException.
        List<QuestionGroupDto> groups = questionService.getGroupedQuestions(courseId, threshold);
        return ResponseEntity.ok(groups);
    }
}
