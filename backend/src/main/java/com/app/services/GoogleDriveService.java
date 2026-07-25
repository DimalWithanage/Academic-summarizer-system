package com.app.services;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.InputStreamContent;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.Permission;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.auth.oauth2.UserCredentials;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class GoogleDriveService {

    @Value("${google.drive.credentials.path:}")
    private String credentialsPath;

    @Value("${google.drive.folder.id:}")
    private String targetFolderId;

    @Value("${google.drive.oauth2.client.id:}")
    private String clientId;

    @Value("${google.drive.oauth2.client.secret:}")
    private String clientSecret;

    @Value("${google.drive.oauth2.refresh.token:}")
    private String refreshToken;

    private final String localUploadDir = "uploads/";

    public String uploadFile(MultipartFile multipartFile) {
        String originalFilename = multipartFile.getOriginalFilename() != null ? multipartFile.getOriginalFilename() : "document.pdf";
        String uniqueId = UUID.randomUUID().toString();
        String cleanFolderId = getCleanFolderId();

        // 1. Try OAuth2 User Credentials if configured
        if (clientId != null && !clientId.isBlank() && refreshToken != null && !refreshToken.isBlank()) {
            try {
                System.out.println("Uploading via OAuth2 User Credentials to Google Drive...");
                return uploadWithUserCredentials(cleanFolderId, multipartFile, originalFilename);
            } catch (Exception e) {
                System.err.println("OAuth2 User Credentials Upload Error: " + e.getMessage());
            }
        }

        // 2. Try Service Account Credentials if file exists
        java.io.File credFile = findCredentialsFile();
        if (credFile != null && cleanFolderId != null) {
            try {
                System.out.println("Uploading file directly to Google Drive Cloud folder: " + cleanFolderId);
                String driveUrl = uploadToGoogleDriveCloud(credFile, cleanFolderId, multipartFile, originalFilename);
                System.out.println("SUCCESSFULLY UPLOADED TO GOOGLE DRIVE: " + driveUrl);
                return driveUrl;
            } catch (Exception e) {
                System.err.println("Google Drive Cloud Upload Error (" + e.getClass().getName() + "): " + e.getMessage());
                if (e.getMessage() != null && e.getMessage().contains("storageQuotaExceeded")) {
                    System.err.println("QUOTA NOTICE: Service Accounts have 0-byte quota for personal Gmail folders. Use a Google Shared Drive or OAuth2 Refresh Token.");
                }
                System.err.println("Falling back to local PDF storage service.");
            }
        }

        // Fallback: Save file to local uploads directory and return working local URL
        try {
            Path uploadPath = Paths.get(localUploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String savedFileName = uniqueId + "_" + originalFilename;
            Path targetPath = uploadPath.resolve(savedFileName);
            Files.copy(multipartFile.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            return "http://localhost:8080/api/materials/files/" + savedFileName;
        } catch (IOException e) {
            System.err.println("Error saving local file: " + e.getMessage());
            return "http://localhost:8080/api/materials/files/" + originalFilename;
        }
    }

    public String diagnoseConnection() {
        if (clientId != null && !clientId.isBlank() && refreshToken != null && !refreshToken.isBlank()) {
            return "INFO: Configured with OAuth2 User Credentials for direct personal Google Drive uploads.";
        }

        java.io.File credFile = findCredentialsFile();
        String cleanFolderId = getCleanFolderId();

        if (credFile == null) {
            return "ERROR: service_account.json key file was not found in backend/src/main/resources/service_account.json.";
        }
        if (cleanFolderId == null) {
            return "ERROR: google.drive.folder.id in application.properties is empty or not configured.";
        }

        try {
            ServiceAccountCredentials credentials;
            try (FileInputStream fis = new FileInputStream(credFile)) {
                credentials = (ServiceAccountCredentials) ServiceAccountCredentials.fromStream(fis)
                        .createScoped(Collections.singleton(DriveScopes.DRIVE));
            }

            Drive driveService = new Drive.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance(),
                    new HttpCredentialsAdapter(credentials))
                    .setApplicationName("AcademicSummarizer")
                    .build();

            // Test folder access
            File folder = driveService.files().get(cleanFolderId)
                    .setSupportsAllDrives(true)
                    .setFields("id, name, mimeType")
                    .execute();

            return "SUCCESS: Connected to Google Drive folder '" + folder.getName() + "' (ID: " + folder.getId() + ") using Service Account email: " + credentials.getClientEmail();

        } catch (GoogleJsonResponseException e) {
            String details = e.getDetails() != null ? e.getDetails().getMessage() : e.getMessage();
            if (e.getStatusCode() == 404) {
                return "GOOGLE DRIVE ERROR 404: Folder ID (" + cleanFolderId + ") was NOT found or has NOT been shared with Service Account email.";
            } else if (e.getStatusCode() == 403) {
                return "GOOGLE DRIVE ERROR 403: Google Drive API error: " + details;
            }
            return "GOOGLE DRIVE API ERROR (" + e.getStatusCode() + "): " + details;
        } catch (Exception e) {
            return "CONNECTIVITY ERROR: " + e.getMessage();
        }
    }

    private String uploadWithUserCredentials(String folderId, MultipartFile multipartFile, String filename) throws Exception {
        UserCredentials credentials = UserCredentials.newBuilder()
                .setClientId(clientId)
                .setClientSecret(clientSecret)
                .setRefreshToken(refreshToken)
                .build();

        Drive driveService = new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(credentials))
                .setApplicationName("AcademicSummarizer")
                .build();

        File fileMetaData = new File();
        fileMetaData.setName(filename);
        if (folderId != null) {
            fileMetaData.setParents(List.of(folderId));
        }

        InputStreamContent mediaContent = new InputStreamContent(
                multipartFile.getContentType() != null ? multipartFile.getContentType() : "application/pdf",
                multipartFile.getInputStream());
        if (multipartFile.getSize() > 0) {
            mediaContent.setLength(multipartFile.getSize());
        }

        File uploadedFile = driveService.files().create(fileMetaData, mediaContent)
                .setSupportsAllDrives(true)
                .setFields("id, webViewLink, webContentLink")
                .execute();

        System.out.println("OAuth2 User Upload Success! File ID: " + uploadedFile.getId() + " | Link: " + uploadedFile.getWebViewLink());

        return uploadedFile.getWebViewLink() != null 
                ? uploadedFile.getWebViewLink() 
                : "https://drive.google.com/file/d/" + uploadedFile.getId() + "/view";
    }

    private String getCleanFolderId() {
        if (targetFolderId == null || targetFolderId.isBlank() || targetFolderId.equals("YOUR_GOOGLE_DRIVE_FOLDER_ID")) {
            return null;
        }
        String id = targetFolderId.trim();
        if (id.contains("/folders/")) {
            id = id.substring(id.indexOf("/folders/") + 9);
        }
        if (id.contains("?")) {
            id = id.substring(0, id.indexOf("?"));
        }
        if (id.contains("/")) {
            id = id.substring(0, id.indexOf("/"));
        }
        return id.isBlank() ? null : id;
    }

    private java.io.File findCredentialsFile() {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            java.io.File f = new java.io.File(credentialsPath);
            if (f.exists() && f.isFile()) return f;
        }
        String[] possiblePaths = {
            "backend/src/main/resources/service_account.json",
            "src/main/resources/service_account.json",
            "service_account.json",
            "target/classes/service_account.json"
        };
        for (String p : possiblePaths) {
            java.io.File f = new java.io.File(p);
            if (f.exists() && f.isFile()) return f;
        }
        return null;
    }

    private String uploadToGoogleDriveCloud(java.io.File keyFile, String folderId, MultipartFile multipartFile, String filename) throws Exception {
        ServiceAccountCredentials credentials;
        try (FileInputStream fis = new FileInputStream(keyFile)) {
            credentials = (ServiceAccountCredentials) ServiceAccountCredentials.fromStream(fis)
                    .createScoped(Collections.singleton(DriveScopes.DRIVE));
        }

        Drive driveService = new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(credentials))
                .setApplicationName("AcademicSummarizer")
                .build();

        File fileMetaData = new File();
        fileMetaData.setName(filename);
        fileMetaData.setParents(List.of(folderId));

        InputStreamContent mediaContent = new InputStreamContent(
                multipartFile.getContentType() != null ? multipartFile.getContentType() : "application/pdf",
                multipartFile.getInputStream());
        if (multipartFile.getSize() > 0) {
            mediaContent.setLength(multipartFile.getSize());
        }

        try {
            File uploadedFile = driveService.files().create(fileMetaData, mediaContent)
                    .setSupportsAllDrives(true)
                    .setFields("id, webViewLink, webContentLink")
                    .execute();

            System.out.println("Google Drive Upload Success! File ID: " + uploadedFile.getId() + " | Web Link: " + uploadedFile.getWebViewLink());

            // Grant public read permission so the uploaded PDF is viewable
            try {
                Permission permission = new Permission()
                        .setType("anyone")
                        .setRole("reader");
                driveService.permissions().create(uploadedFile.getId(), permission)
                        .setSupportsAllDrives(true)
                        .execute();
            } catch (Exception permissionException) {
                System.err.println("Note: Permission grant warning: " + permissionException.getMessage());
            }

            return uploadedFile.getWebViewLink() != null 
                    ? uploadedFile.getWebViewLink() 
                    : "https://drive.google.com/file/d/" + uploadedFile.getId() + "/view";
        } catch (GoogleJsonResponseException e) {
            System.err.println("=== GOOGLE DRIVE UPLOAD ERROR DIAGNOSIS ===");
            System.err.println("HTTP Code: " + e.getStatusCode());
            System.err.println("Message: " + (e.getDetails() != null ? e.getDetails().getMessage() : e.getMessage()));
            System.err.println("Service Account Email: " + credentials.getClientEmail());
            System.err.println("Target Folder ID: " + folderId);
            throw e;
        }
    }
}
