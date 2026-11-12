-- Una base de datos por microservicio (patrón "database per service")
CREATE DATABASE patients_db;
CREATE DATABASE appointments_db;
CREATE DATABASE triage_db;

-- pgvector solo lo necesita el servicio de triaje (RAG)
\c triage_db
CREATE EXTENSION IF NOT EXISTS vector;
