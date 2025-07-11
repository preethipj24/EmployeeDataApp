-- CREATE DATABASE IF NOT EXISTS employee_db;

-- USE employee_db;

-- CREATE TABLE IF NOT EXISTS employees (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     first_name VARCHAR(255) NOT NULL,
--     middle_name VARCHAR(255),
--     last_name VARCHAR(255) NOT NULL,
--     department VARCHAR(255),
--     designation VARCHAR(255),
--     location VARCHAR(255),
--     blood_group VARCHAR(10),
--     father_husband_name VARCHAR(255) NOT NULL,
--     mobile_no VARCHAR(20) NOT NULL,
--     address_bangalore TEXT NOT NULL,
--     pincode_bangalore VARCHAR(10) NOT NULL,
--     permanent_address TEXT NOT NULL,
--     permanent_pincode VARCHAR(10) NOT NULL,
--     email_id VARCHAR(255) NOT NULL,
--     date_of_birth DATE NOT NULL,
--     marital_status VARCHAR(50),
--     ec_person_name VARCHAR(255) NOT NULL,
--     ec_contact_number VARCHAR(20) NOT NULL,
--     ec_relationship VARCHAR(100) NOT NULL,
--     -- Dependents (consider storing as JSON string or in a separate table)
--     dependents_details JSON,
--     -- Education (consider storing as JSON string or in a separate table)
--     highest_education TEXT,
--     education_details JSON,
--     -- Work Experience (consider storing as JSON string or in a separate table)
--     work_experience_details JSON,
--     signature_image_data LONGTEXT, -- To store base64 image of signature
--     declaration_date DATE,
--     declaration_place VARCHAR(255),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );



CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY, -- SERIAL for auto-incrementing integer in PostgreSQL
    first_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    last_name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    designation VARCHAR(255),
    location VARCHAR(255),
    blood_group VARCHAR(10),
    father_husband_name VARCHAR(255) NOT NULL,
    mobile_no VARCHAR(20) NOT NULL,
    address_bangalore TEXT NOT NULL,
    pincode_bangalore VARCHAR(10) NOT NULL,
    permanent_address TEXT NOT NULL,
    permanent_pincode VARCHAR(10) NOT NULL,
    email_id VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    marital_status VARCHAR(50),
    ec_person_name VARCHAR(255) NOT NULL,
    ec_contact_number VARCHAR(20) NOT NULL,
    ec_relationship VARCHAR(100) NOT NULL,
    dependents_details JSONB, -- JSONB is preferred for JSON in PostgreSQL
    highest_education TEXT,
    education_details JSONB,
    work_experience_details JSONB,
    signature_image_data TEXT, -- LONGTEXT equivalent for base64 image data
    declaration_date DATE,
    declaration_place VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);