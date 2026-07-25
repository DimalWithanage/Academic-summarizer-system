package com.app.dto;

import com.app.models.ContentType;

public class GenerateDto {

    public static class Request {
        private Integer materialId;
        private ContentType contentType;
        private Integer questionCount; // for quiz

        public Request() {}

        public Request(Integer materialId, ContentType contentType, Integer questionCount) {
            this.materialId = materialId;
            this.contentType = contentType;
            this.questionCount = questionCount;
        }

        public Integer getMaterialId() { return materialId; }
        public void setMaterialId(Integer materialId) { this.materialId = materialId; }
        public ContentType getContentType() { return contentType; }
        public void setContentType(ContentType contentType) { this.contentType = contentType; }
        public Integer getQuestionCount() { return questionCount; }
        public void setQuestionCount(Integer questionCount) { this.questionCount = questionCount; }
    }

    public static class Response {
        private Integer contentId;
        private Integer materialId;
        private ContentType contentType;
        private String aiOutput;

        public Response() {}

        public Response(Integer contentId, Integer materialId, ContentType contentType, String aiOutput) {
            this.contentId = contentId;
            this.materialId = materialId;
            this.contentType = contentType;
            this.aiOutput = aiOutput;
        }

        public Integer getContentId() { return contentId; }
        public void setContentId(Integer contentId) { this.contentId = contentId; }
        public Integer getMaterialId() { return materialId; }
        public void setMaterialId(Integer materialId) { this.materialId = materialId; }
        public ContentType getContentType() { return contentType; }
        public void setContentType(ContentType contentType) { this.contentType = contentType; }
        public String getAiOutput() { return aiOutput; }
        public void setAiOutput(String aiOutput) { this.aiOutput = aiOutput; }
    }
}
