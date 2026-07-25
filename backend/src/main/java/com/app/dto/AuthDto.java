package com.app.dto;

public class AuthDto {

    public static class Request {
        private String email;
        private String password;
        private String name;

        public Request() {}

        public Request(String email, String password, String name) {
            this.email = email;
            this.password = password;
            this.name = name;
        }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

    public static class Response {
        private Integer userId;
        private String email;
        private String token;
        private String message;

        public Response() {}

        public Response(Integer userId, String email, String token, String message) {
            this.userId = userId;
            this.email = email;
            this.token = token;
            this.message = message;
        }

        public Integer getUserId() { return userId; }
        public void setUserId(Integer userId) { this.userId = userId; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
