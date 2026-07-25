package com.app.repositories;

import com.app.models.ContentType;
import com.app.models.GeneratedContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GeneratedContentRepository extends JpaRepository<GeneratedContent, Integer> {
    List<GeneratedContent> findByMaterialMaterialId(Integer materialId);
    Optional<GeneratedContent> findFirstByMaterialMaterialIdAndContentTypeOrderByContentIdDesc(Integer materialId, ContentType contentType);
}

