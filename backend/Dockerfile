FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY maven-settings.xml maven-build.sh ./
RUN sh ./maven-build.sh dependency:go-offline
COPY src ./src
RUN sh ./maven-build.sh package
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system campus && useradd --system --gid campus campus
COPY --from=build /build/target/campus-events.jar app.jar
USER campus
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=65.0","-jar","/app/app.jar"]
