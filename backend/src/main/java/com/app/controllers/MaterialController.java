package com.app.controllers;

import com.app.dto.MaterialDto;
import com.app.services.GoogleDriveService;
import com.app.services.MaterialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/materials")
public class MaterialController {

    private final MaterialService materialService;
    private final GoogleDriveService googleDriveService;

    public MaterialController(MaterialService materialService, GoogleDriveService googleDriveService) {
        this.materialService = materialService;
        this.googleDriveService = googleDriveService;
    }

    @PostMapping("/upload")
    public ResponseEntity<MaterialDto> uploadMaterial(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "userId", required = false) Integer userId) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        MaterialDto dto = materialService.uploadMaterial(file, userId);
        return ResponseEntity.ok(dto);
    }

    @GetMapping
    public ResponseEntity<List<MaterialDto>> getMaterials(
            @RequestParam(value = "userId", required = false) Integer userId) {
        List<MaterialDto> list = materialService.getMaterialsByUser(userId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/drive-status")
    public ResponseEntity<String> testDriveStatus() {
        String status = googleDriveService.diagnoseConnection();
        return ResponseEntity.ok(status);
    }
}
