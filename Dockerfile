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

# Copy compiled JAR from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose the Spring Boot default port
EXPOSE 8080

# Run the application — SPRING_PROFILES_ACTIVE=prod tells Spring Boot to load
# application-prod.properties which uses ${ENV_VAR} placeholders.
# Cloud Run injects the real values as environment variables at deploy time.
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
