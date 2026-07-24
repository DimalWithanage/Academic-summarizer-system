-- Database Schema for Academic Material Summarizer and Quiz Generator

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
    material_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    file_name VARCHAR(255),
    gcp_storage_url VARCHAR(512),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_content (
    content_id INT PRIMARY KEY AUTO_INCREMENT,
    material_id INT,
    content_type VARCHAR(50) NOT NULL,
    ai_output TEXT,
    FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE
);
