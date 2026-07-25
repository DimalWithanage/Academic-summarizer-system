package com.app.models;

import jakarta.persistence.*;

@Entity
@Table(name = "generated_content")
public class GeneratedContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "content_id")
    private Integer contentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id")
    private Material material;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 50)
    private ContentType contentType;

    @Column(name = "ai_output", columnDefinition = "TEXT")
    private String aiOutput;

    public GeneratedContent() {
    }

    public GeneratedContent(Material material, ContentType contentType, String aiOutput) {
        this.material = material;
        this.contentType = contentType;
        this.aiOutput = aiOutput;
    }

    // Getters and Setters
    public Integer getContentId() {
        return contentId;
    }

    public void setContentId(Integer contentId) {
        this.contentId = contentId;
    }

    public Material getMaterial() {
        return material;
    }

    public void setMaterial(Material material) {
        this.material = material;
    }

    public ContentType getContentType() {
        return contentType;
    }

    public void setContentType(ContentType contentType) {
        this.contentType = contentType;
    }

    public String getAiOutput() {
        return aiOutput;
    }

    public void setAiOutput(String aiOutput) {
        this.aiOutput = aiOutput;
    }
}
