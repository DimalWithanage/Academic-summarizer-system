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

# Copy compiled JAR safely and explicitly
COPY --from=builder /app/target/academic-summarizer-0.0.1-SNAPSHOT.jar app.jar

# Expose the Cloud Run expected port
EXPOSE 8080

# Run the application bound to 0.0.0.0 (Cloud Run requirement)
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-Dserver.port=${PORT:8080}", "-Dserver.address=0.0.0.0", "-jar", "app.jar"]
