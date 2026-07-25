package com.app.services;

import com.app.dto.MaterialDto;
import com.app.models.ContentType;
import com.app.models.GeneratedContent;
import com.app.models.Material;
import com.app.models.User;
import com.app.repositories.GeneratedContentRepository;
import com.app.repositories.MaterialRepository;
import com.app.repositories.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class MaterialService {

    private final MaterialRepository materialRepository;
    private final GeneratedContentRepository contentRepository;
    private final UserRepository userRepository;
    private final GoogleDriveService driveService;
    private final GeminiService geminiService;

    public MaterialService(MaterialRepository materialRepository,
                           GeneratedContentRepository contentRepository,
                           UserRepository userRepository,
                           GoogleDriveService driveService,
                           GeminiService geminiService) {
        this.materialRepository = materialRepository;
        this.contentRepository = contentRepository;
        this.userRepository = userRepository;
        this.driveService = driveService;
        this.geminiService = geminiService;
    }

    public MaterialDto uploadMaterial(MultipartFile file, Integer userId) {
        User user = null;
        if (userId != null) {
            user = userRepository.findById(userId).orElse(null);
        }

        String driveUrl = driveService.uploadFile(file);
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "academic_document.pdf";

        Material material = new Material(user, fileName, driveUrl);
        Material saved = materialRepository.save(material);

        byte[] pdfBytes = null;
        try {
            pdfBytes = file.getBytes();
        } catch (Exception e) {
            System.err.println("Could not read file bytes: " + e.getMessage());
        }

        // Direct Multimodal PDF prompting to Gemini API for Summary
        String summaryMarkdown = geminiService.generateContentWithPdfBytes(pdfBytes, fileName, ContentType.SUMMARY, 0);
        Optional<GeneratedContent> existingSummary = contentRepository.findFirstByMaterialMaterialIdAndContentTypeOrderByContentIdDesc(saved.getMaterialId(), ContentType.SUMMARY);
        if (existingSummary.isPresent()) {
            GeneratedContent content = existingSummary.get();
            content.setAiOutput(summaryMarkdown);
            contentRepository.save(content);
        } else {
            GeneratedContent summaryContent = new GeneratedContent(saved, ContentType.SUMMARY, summaryMarkdown);
            contentRepository.save(summaryContent);
        }

        return new MaterialDto(saved.getMaterialId(), saved.getFileName(), saved.getGcpStorageUrl(), saved.getUploadedAt());
    }

    public List<MaterialDto> getMaterialsByUser(Integer userId) {
        List<Material> materials = (userId != null) 
            ? materialRepository.findByUserUserIdOrderByUploadedAtDesc(userId)
            : materialRepository.findAll();

        return materials.stream()
                .map(m -> new MaterialDto(m.getMaterialId(), m.getFileName(), m.getGcpStorageUrl(), m.getUploadedAt()))
                .collect(Collectors.toList());
    }

    public String getOrGenerateContent(Integer materialId, ContentType type, int count) {
        Optional<GeneratedContent> existing = contentRepository.findFirstByMaterialMaterialIdAndContentTypeOrderByContentIdDesc(materialId, type);
        if (existing.isPresent()) {
            return existing.get().getAiOutput();
        }

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Material not found with ID: " + materialId));

        // Use existing summary text as input if available for quiz generation
        String inputPrompt = material.getFileName();
        if (type == ContentType.QUIZ) {
            Optional<GeneratedContent> summaryOpt = contentRepository.findFirstByMaterialMaterialIdAndContentTypeOrderByContentIdDesc(materialId, ContentType.SUMMARY);
            if (summaryOpt.isPresent() && summaryOpt.get().getAiOutput() != null) {
                inputPrompt = summaryOpt.get().getAiOutput();
            }
        }

        String aiResult = geminiService.generateContent(inputPrompt, type, count);
        GeneratedContent content = new GeneratedContent(material, type, aiResult);
        contentRepository.save(content);

        return aiResult;
    }

}
