# ---- Stage 1: Build the Spring Boot JAR ----
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

COPY backend/pom.xml ./pom.xml
COPY backend/src ./src

RUN apk add --no-cache maven
RUN mvn -B package -DskipTests --file pom.xml

# ---- Stage 2: Runtime Image (lightweight JRE) ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy compiled JAR
COPY --from=builder /app/target/academic-summarizer-0.0.1-SNAPSHOT.jar app.jar

# Expose default port (Cloud Run overrides with $PORT env var)
EXPOSE 8080

# Use SHELL form (not exec form) so $PORT env variable is expanded at runtime.
# Cloud Run injects PORT env var; Spring Boot reads it via server.port=${PORT:8080}
# server.address=0.0.0.0 ensures Cloud Run's TCP probe can reach the app.
ENTRYPOINT exec java \
  -Dspring.profiles.active=prod \
  -Dserver.address=0.0.0.0 \
  -jar app.jar
