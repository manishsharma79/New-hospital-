# Hospital Management Information System — Spring Boot & MySQL 8 Backend

## Prerequisites

- Java 17 or Java 21
- Apache Maven 3.9+
- MySQL 8.0+

## Database Setup (MySQL Workbench / CLI)

1. Run `database/schema.sql` to create `hmis_database` and all 14 relational tables.
2. Run `database/seed.sql` to insert roles, permissions, departments, BCrypt-hashed staff, patients, appointments, and medicines.

## Environment Variables

Configure the following environment variables before running Spring Boot (never commit secrets):

- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `3306`)
- `DB_NAME` (default `hmis_database`)
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET` (minimum 32 characters)

## Run Backend

```bash
cd backend
mvn spring-boot:run
```
