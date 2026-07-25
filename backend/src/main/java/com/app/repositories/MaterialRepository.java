package com.app.repositories;

import com.app.models.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialRepository extends JpaRepository<Material, Integer> {
    List<Material> findByUserUserIdOrderByUploadedAtDesc(Integer userId);
}
