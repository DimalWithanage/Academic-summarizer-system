package com.app.services;

import com.app.dto.AuthDto;
import com.app.models.User;
import com.app.repositories.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public AuthDto.Response register(AuthDto.Request request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("User with email " + request.getEmail() + " already exists.");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());
        User user = new User(request.getEmail(), hashedPassword);
        User savedUser = userRepository.save(user);

        String token = UUID.randomUUID().toString();
        return new AuthDto.Response(savedUser.getUserId(), savedUser.getEmail(), token, "Account created successfully.");
    }

    public AuthDto.Response login(AuthDto.Request request) {
        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail());
        if (optionalUser.isEmpty()) {
            throw new IllegalArgumentException("Invalid email or password.");
        }

        User user = optionalUser.get();
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password.");
        }

        String token = UUID.randomUUID().toString();
        return new AuthDto.Response(user.getUserId(), user.getEmail(), token, "Logged in successfully.");
    }
}
