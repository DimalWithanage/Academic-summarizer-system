package com.app.dto;

import java.time.LocalDateTime;

public class MaterialDto {

    private Integer materialId;
    private String fileName;
    private String gcpStorageUrl;
    private LocalDateTime uploadedAt;

    public MaterialDto() {}

    public MaterialDto(Integer materialId, String fileName, String gcpStorageUrl, LocalDateTime uploadedAt) {
        this.materialId = materialId;
        this.fileName = fileName;
        this.gcpStorageUrl = gcpStorageUrl;
        this.uploadedAt = uploadedAt;
    }

    public Integer getMaterialId() { return materialId; }
    public void setMaterialId(Integer materialId) { this.materialId = materialId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getGcpStorageUrl() { return gcpStorageUrl; }
    public void setGcpStorageUrl(String gcpStorageUrl) { this.gcpStorageUrl = gcpStorageUrl; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
}
