package com.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

// Exclude Spring Security default login screen for initial project skeleton boot
@SpringBootApplication(exclude = { SecurityAutoConfiguration.class })
public class AcademicSummarizerApplication {
    public static void main(String[] args) {
        SpringApplication.run(AcademicSummarizerApplication.class, args);
    }
}
