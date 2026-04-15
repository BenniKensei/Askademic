# Askademic - Learning Management Platform

> Askademic enables professors and students to run high-signal course Q&A workflows with role-based access, real-time collaboration, and AI-assisted question grouping.

[![Build](https://img.shields.io/badge/build-pending-lightgrey)](#)
[![Tests](https://img.shields.io/badge/tests-pending-lightgrey)](#)

---

## I. Executive Summary

Askademic is a full-stack learning management platform designed for universities and technical courses where high question volume can overwhelm instructors. It serves three user types:

- Student: enrolls in courses, posts questions, answers peers, and tracks updates.
- Professor: creates courses, publishes announcements, answers and verifies questions, and moderates content.
- Admin: monitors system-level usage and manages platform-wide data.

Core functionality:

- JWT-based authentication and role-based authorization
- Course creation and enrollment by code
- Question and answer lifecycle with verification
- AI-powered semantic grouping for repeated questions
- Announcement publishing with student notifications

---

## II. Architecture & Tech Stack

### Frontend

- React 18
- React Router
- Axios
- Tailwind CSS

### Backend

- Spring Boot 3.2
- Java 17
- Spring Security
- JPA/Hibernate

### Database

- PostgreSQL 15
- pgvector extension for embedding vectors

### Infrastructure

- Docker Compose for local orchestration
- Maven for backend build/test
- npm for frontend build/test

### Data Flow

Client Request -> React Client -> Spring Security Filter Chain -> Controller -> Service Layer -> Repository -> PostgreSQL/pgvector -> JSON Response -> React State Update

### Security Design Notes

- API is stateless and uses bearer JWT tokens.
- CORS is configured to allow trusted frontend origins only.
- Authorization checks are enforced at endpoint level and ownership checks are enforced in service/controller logic.

---

## III. Environment Variables

Use environment-specific files or runtime variables. Do not commit real credentials.

| Variable | Required | Scope | Purpose | Dummy Example |
|---|---|---|---|---|
| DB_URL | Yes | Backend | JDBC URL for PostgreSQL | jdbc:postgresql://localhost:5431/askademy |
| DB_USERNAME | Yes | Backend | PostgreSQL username | askademy_user |
| DB_PASSWORD | Yes | Backend | PostgreSQL password | askademy_password |
| JWT_SECRET | Yes | Backend | JWT signing key | replace_with_long_random_secret_value |
| JWT_EXPIRATION_MS | No | Backend | Access token TTL in milliseconds | 86400000 |
| CORS_ALLOWED_ORIGINS | No | Backend | Allowed web origins | http://localhost:3000 |
| SPRING_PROFILES_ACTIVE | No | Backend | Runtime profile selector | dev |
| REACT_APP_API_BASE_URL | No | Frontend | Backend API base URL | http://localhost:8080/api |

---

## IV. Quickstart

### Option A: Docker Compose (database + backend service)

```bash
git clone https://github.com/BenniKensei/Askademic.git
cd Askademic
docker-compose up -d postgres backend
```

Start frontend in a second terminal:

```bash
cd frontend
npm install
npm start
```

### Option B: Database in Docker, backend/frontend local

```bash
git clone https://github.com/BenniKensei/Askademic.git
cd Askademic
docker-compose up -d postgres
```

Backend:

```bash
cd backend
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm start
```

Local URLs:

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- PostgreSQL host port: 5431

Friction points to check first:

- Port collision on 3000, 5431, or 8080
- Docker Desktop not running
- Wrong API base URL in frontend config
- Missing JWT_SECRET for non-default environments

---

## V. API Documentation

If OpenAPI/Swagger is enabled in your current profile:

- http://localhost:8080/swagger-ui/index.html
- http://localhost:8080/v3/api-docs

Core REST endpoints:

| Method | Path | Auth | Request Body | Success Response | Common Status Codes |
|---|---|---|---|---|---|
| POST | /api/auth/login | Public | LoginRequest | AuthResponse | 200, 401 |
| POST | /api/auth/register | Public | RegisterRequest | AuthResponse | 200, 400 |
| GET | /api/courses | Authenticated | None | List<Course> | 200, 401 |
| POST | /api/courses | PROFESSOR | CourseRequest | Course | 200, 401, 403 |
| POST | /api/courses/{id}/enroll | STUDENT | None | Message | 200, 401, 403 |
| GET | /api/questions/course/{courseId} | PROFESSOR/STUDENT | Query filter optional | List<Question> | 200, 401, 403 |
| POST | /api/questions | PROFESSOR/STUDENT | QuestionRequest | Question | 200, 400, 401 |
| GET | /api/questions/grouped/{courseId} | PROFESSOR/STUDENT | Query threshold optional | List<QuestionGroupDto> | 200, 400, 401 |
| POST | /api/answers | PROFESSOR/STUDENT | AnswerRequest | Answer | 200, 400, 401 |
| POST | /api/answers/batch | PROFESSOR | BatchAnswerRequest | List<Answer> | 200, 400, 401, 403 |
| PUT | /api/answers/{id}/verify | PROFESSOR | None | Answer | 200, 401, 403, 404 |
| GET | /api/admin/stats | ADMIN | None | Map<String,Long> | 200, 401, 403 |

---

## VI. Testing

Backend unit and integration tests:

```bash
cd backend
mvn clean test
```

Frontend component/unit tests:

```bash
cd frontend
npm test -- --watchAll=false
```

Optional full backend verification:

```bash
cd backend
mvn verify
```

---

## VII. Known Limitations & Trade-offs

- JWT secret and expiration handling are partly hard-coded in utility class and should be fully externalized for production hardening.
- AI grouping quality depends on embedding quality and can vary for short or ambiguous questions.
- Grouping currently uses greedy clustering, which is fast but may not produce globally optimal clusters.
- Frontend relies on full refetch after many write operations instead of optimistic updates, which increases API traffic.
- Some destructive actions use browser confirm dialogs, which are simple but not ideal for accessibility and rich undo workflows.
- Error handling in some flows returns generic messages; detailed structured error objects are still limited.

---

## VIII. Contribution Notes

Commenting conventions used in this codebase:

- Frontend: JSDoc comments for props, state rationale, and effect dependencies.
- Backend: endpoint contract comments including method, path, auth, request, response, and status codes.
- Technical debt tags: use `# TODO:` and `# FIXME:` in code comments.
