package com.app.controllers;

import com.app.dto.GenerateDto;
import com.app.models.ContentType;
import com.app.services.MaterialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final MaterialService materialService;

    public AiController(MaterialService materialService) {
        this.materialService = materialService;
    }

    @PostMapping("/summary")
    public ResponseEntity<GenerateDto.Response> generateSummary(@RequestBody GenerateDto.Request request) {
        try {
            String output = materialService.getOrGenerateContent(request.getMaterialId(), ContentType.SUMMARY, 0);
            return ResponseEntity.ok(new GenerateDto.Response(null, request.getMaterialId(), ContentType.SUMMARY, output));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new GenerateDto.Response(null, request.getMaterialId(), ContentType.SUMMARY, "Error: " + e.getMessage()));
        }
    }

    @PostMapping("/quiz")
    public ResponseEntity<GenerateDto.Response> generateQuiz(@RequestBody GenerateDto.Request request) {
        try {
            int count = (request.getQuestionCount() != null && request.getQuestionCount() > 0) ? request.getQuestionCount() : 10;
            String output = materialService.getOrGenerateContent(request.getMaterialId(), ContentType.QUIZ, count);
            return ResponseEntity.ok(new GenerateDto.Response(null, request.getMaterialId(), ContentType.QUIZ, output));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new GenerateDto.Response(null, request.getMaterialId(), ContentType.QUIZ, "Error: " + e.getMessage()));
        }
    }
}
