const express = require('express');
const mysql = require('mysql2/promise'); // Use promise-based version
const bodyParser = require('body-parser');
const pdf = require('html-pdf');
const cors = require('cors'); // Import cors

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json({ limit: '50mb' })); // To handle large payloads like base64 images
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); // For URL-encoded data

// Serve static files (your HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

// MySQL Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // Your MySQL username
    password: 'root123', // Your MySQL password
    database: 'employee_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection
pool.getConnection()
    .then(connection => {
        console.log('Connected to MySQL database!');
        connection.release(); // Release the connection back to the pool
    })
    .catch(err => {
        console.error('Error connecting to MySQL:', err.message);
    });

// --- API Endpoints ---

// 1. Endpoint to save employee data
app.post('/api/employees', async (req, res) => {
    const employeeData = req.body;
    console.log('Received employee data:', employeeData);

    // Basic validation (add more robust validation as needed)
    if (!employeeData.first_name || !employeeData.last_name || !employeeData.email_id) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Convert empty strings for date and place to NULL for database insertion
    const declarationDate = employeeData.declaration_date === '' ? null : employeeData.declaration_date;
    const declarationPlace = employeeData.declaration_place === '' ? null : employeeData.declaration_place;

    try {
        const [result] = await pool.execute(
            `INSERT INTO employees (
                first_name, middle_name, last_name, department, designation, location,
                blood_group, father_husband_name, mobile_no, address_bangalore, pincode_bangalore,
                permanent_address, permanent_pincode, email_id, date_of_birth, marital_status,
                ec_person_name, ec_contact_number, ec_relationship,
                dependents_details, highest_education, education_details, work_experience_details,
                signature_image_data, declaration_date, declaration_place
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employeeData.first_name, employeeData.middle_name, employeeData.last_name,
                employeeData.department, employeeData.designation, employeeData.location,
                employeeData.blood_group, employeeData.father_husband_name, employeeData.mobile_no,
                employeeData.address_bangalore, employeeData.pincode_bangalore,
                employeeData.permanent_address, employeeData.permanent_pincode, employeeData.email_id,
                employeeData.date_of_birth, employeeData.marital_status,
                employeeData.ec_person_name, employeeData.ec_contact_number, employeeData.ec_relationship,
                // Ensure these are always valid JSON strings, even if empty array []
                JSON.stringify(employeeData.dependents_details || []),
                employeeData.highest_education,
                JSON.stringify(employeeData.education_details || []),
                JSON.stringify(employeeData.work_experience_details || []),
                employeeData.signature_image_data, // Base64 string
                declarationDate, // Use the potentially NULL value
                declarationPlace // Use the potentially NULL value
            ]
        );
        res.status(201).json({ message: 'Employee data saved successfully!', id: result.insertId });
    } catch (error) {
        console.error('Error saving employee data:', error);
        res.status(500).json({ message: 'Error saving employee data.', error: error.message });
    }
});

// Helper function to safely parse JSON
const safeParseJSON = (data) => {
    // If the data is already an array or object, return it directly
    if (typeof data === 'object' && data !== null) {
        return data;
    }
    // If it's a string, try to parse it
    const str = String(data || '').trim();
    if (str === '') {
        return []; // Return empty array for null, undefined, or empty/whitespace-only strings
    }
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : []; // Ensure it's an array, or default to empty
    } catch (e) {
        console.error('Error parsing JSON string:', `"${str}"`, e);
        return [];
    }
};

// 2. Endpoint to get all employee data
app.get('/api/employees', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM employees');
        // Parse JSON fields back to objects using the safeParseJSON helper
        const employees = rows.map(row => ({
            ...row,
            dependents_details: safeParseJSON(row.dependents_details),
            education_details: safeParseJSON(row.education_details),
            work_experience_details: safeParseJSON(row.work_experience_details)
        }));
        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employee data:', error);
        res.status(500).json({ message: 'Error fetching employee data.', error: error.message });
    }
});

// 3. Endpoint to get a single employee's data by ID
app.get('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found.' });
        }
        const employee = {
            ...rows[0],
            dependents_details: safeParseJSON(rows[0].dependents_details),
            education_details: safeParseJSON(rows[0].education_details),
            work_experience_details: safeParseJSON(rows[0].work_experience_details)
        };
        res.status(200).json(employee);
    } catch (error) {
        console.error('Error fetching single employee data:', error);
        res.status(500).json({ message: 'Error fetching employee data.', error: error.message });
    }
});

// 4. Endpoint to generate PDF
app.get('/api/employees/:id/pdf', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found.' });
        }
        const employeeData = {
            ...rows[0],
            dependents_details: safeParseJSON(rows[0].dependents_details),
            education_details: safeParseJSON(rows[0].education_details),
            work_experience_details: safeParseJSON(rows[0].work_experience_details)
        };

        // Generate HTML for PDF
        let pdfHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee Details - ${employeeData.first_name || ''} ${employeeData.last_name || ''}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <!-- Bootstrap 5 CSS for general layout, but custom styles for tables -->
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Inter', sans-serif;
                        padding: 2rem;
                    }
                    .container {
                        max-width: 960px;
                        margin: 0 auto;
                        padding: 2rem;
                    }
                    h2 {
                        text-align: center;
                        margin-bottom: 1.5rem;
                        font-size: 2rem;
                        font-weight: bold;
                        text-decoration: underline;
                        color: #333;
                    }
                    .text-muted {
                        color: #6c757d;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .form-label {
                        font-weight: bold;
                    }
                    .form-section {
                        margin-bottom: 1.5rem;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px;
                        vertical-align: top;
                        font-size: 11pt;
                    }
                    th {
                        background-color: #f0f0f0;
                    }
                    img { /* For signature image */
                        max-width: 200px;
                        height: auto;
                        border: 1px solid #ccc;
                    }
                    .signature-container {
                        text-align: right; /* Align signature to the right */
                        padding-top: 3rem;
                    }
                    .signature-label {
                        display: block;
                        font-weight: bold;
                        margin-bottom: 0.5rem;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>EMPLOYEE JOINING REPORT</h2>
                    <p class="text-muted text-center">Give all the information (CAPITAL LETTERS ONLY) in full and correct (Name and DOB As Per Aadhar)</p>

                    <div class="row form-section">
                        <div class="col-4">
                            <label class="form-label">First Name</label>
                            <p>${employeeData.first_name || ''}</p>
                        </div>
                        <div class="col-4">
                            <label class="form-label">Middle Name</label>
                            <p>${employeeData.middle_name || ''}</p>
                        </div>
                        <div class="col-4">
                            <label class="form-label">Last Name</label>
                            <p>${employeeData.last_name || ''}</p>
                        </div>
                    </div>

                    <div class="row form-section">
                        <div class="col-6">
                            <label class="form-label">Department</label>
                            <p>${employeeData.department || ''}</p>
                        </div>
                        <div class="col-6">
                            <label class="form-label">Designation</label>
                            <p>${employeeData.designation || ''}</p>
                        </div>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Location</label>
                        <p>${employeeData.location || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Blood Group</label>
                        <p>${employeeData.blood_group || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Father / Husband’s Name</label>
                        <p>${employeeData.father_husband_name || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Mobile No</label>
                        <p>${employeeData.mobile_no || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Address for Communication in Bangalore</label>
                        <p>${employeeData.address_bangalore || ''}</p>
                        <p>Pin Code: ${employeeData.pincode_bangalore || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Permanent Address</label>
                        <p>${employeeData.permanent_address || ''}</p>
                        <p>Pin Code: ${employeeData.permanent_pincode || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Email ID</label>
                        <p>${employeeData.email_id || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Date of Birth (Day/Month/Year)</label>
                        <p>${employeeData.date_of_birth ? new Date(employeeData.date_of_birth).toLocaleDateString('en-GB') : ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Marital Status</label>
                        <p>${employeeData.marital_status || ''}</p>
                    </div>

                    <div class="form-section">
                        <label class="form-label">Emergency Contact (EC) Person</label>
                        <p>${employeeData.ec_person_name || ''}</p>
                        <p>EC Contact Number: ${employeeData.ec_contact_number || ''}</p>
                        <p>Relationship: ${employeeData.ec_relationship || ''}</p>
                    </div>

                    <hr style="margin: 1.5rem 0; border-top: 1px solid #ccc;">

                    <div class="form-section">
                        <strong style="display: block; margin-bottom: 0.5rem;">Dependents Details (Mandatory):</strong>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <thead>
                                <tr style="background-color: #f0f0f0;">
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 5%;">SL. No</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">Name</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 20%;">Relationship<br>With Employee</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">Date of<br>Birth of Dependent</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 25%;">Permanent Address</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 20%;">Contact Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employeeData.dependents_details && employeeData.dependents_details.length > 0 ?
                                    employeeData.dependents_details.map((dep, index) => `
                                        <tr>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${index + 1}.</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${dep.name || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${dep.relationship || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${dep.dob || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${dep.address || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${dep.contact || ''}</td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="6" style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">No Dependent Details</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="form-section">
                        <strong style="display: block; margin-bottom: 0.5rem;">Highest Education:</strong>
                        <p>${employeeData.highest_education || ''}</p>
                    </div>

                    <hr style="margin: 1.5rem 0; border-top: 1px solid #ccc;">
                    <div class="form-section">
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <thead>
                                <tr style="background-color: #f0f0f0;">
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 10%;">S.No.</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 20%;">Qualification</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 30%;">University & College<br>(Fill Both the Details)</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 20%;">Year of Passing</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 20%;">Percentage % Obtained</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employeeData.education_details && employeeData.education_details.length > 0 ?
                                    employeeData.education_details.map((edu, index) => `
                                        <tr>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${index + 1}.</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${edu.qualification || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${edu.university_college || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${edu.year_of_passing || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${edu.percentage || ''}</td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="5" style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">No Education Details</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="form-section">
                        <strong style="display: block; margin-bottom: 0.5rem;">Work Experiences (If any):</strong>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <thead>
                                <tr style="background-color: #f0f0f0;">
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 5%;">S.No.</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 20%;">Organization</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">Department</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">Designation</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">Start Date<br>(Mandatory)</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">End Date<br>(Mandatory)</th>
                                    <th style="border: 1px solid #000; padding: 8px; vertical-align: top; width: 15%;">Salary Drawn</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employeeData.work_experience_details && employeeData.work_experience_details.length > 0 ?
                                    employeeData.work_experience_details.map((exp, index) => `
                                        <tr>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${index + 1}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${exp.organization || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${exp.department || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${exp.designation || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${exp.start_date || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${exp.end_date || ''}</td>
                                            <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">${exp.salary || ''}</td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="7" style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">No Work Experience Details</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="form-section" style="margin-top: 2rem;">
                        <strong style="display: block; margin-bottom: 0.5rem;">Declaration:</strong>
                        <p style="margin-top: 0.5rem; line-height: 1.625;">
                            I hereby declare that the information given above is correct and true to the best of my knowledge.
                            I understand that any misrepresentation of facts may be called for disciplinary action.
                        </p>

                        <table style="width: 100%; border-collapse: collapse; margin-top: 2rem;">
                            <tr style="border: none;">
                                <td style="width: 50%; padding: 8px; border: none;">
                                    <label style="display: block; font-weight: bold; margin-bottom: 0.25rem;">Date:</label>
                                    <p>${employeeData.declaration_date ? new Date(employeeData.declaration_date).toLocaleDateString('en-GB') : ''}</p>
                                </td>
                                <td style="width: 50%; padding: 8px; border: none;">
                                    <label style="display: block; font-weight: bold; margin-bottom: 0.25rem;">Place:</label>
                                    <p>${employeeData.declaration_place || ''}</p>
                                </td>
                            </tr>
                            <tr style="border: none;">
                                <td colspan="2" class="signature-container" style="border: none;">
                                    <label class="signature-label">Signature of Employee:</label>
                                    ${employeeData.signature_image_data ? `<img src="${employeeData.signature_image_data}" alt="Employee Signature" style="width: 200px; height: 80px; display: block; margin-left: auto; border: 1px solid #ccc;"/>` : `<p style="text-align: right;">No signature provided.</p>`}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </body>
            </html>
        `;


        pdf.create(pdfHtml, { format: 'A4' }).toBuffer((err, buffer) => {
            if (err) {
                console.error('Error generating PDF:', err);
                return res.status(500).json({ message: 'Error generating PDF.', error: err.message });
            }
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=employee_${id}.pdf`
            });
            res.end(buffer);
        });

    } catch (error) {
        console.error('Error fetching employee data for PDF:', error);
        res.status(500).json({ message: 'Error fetching employee data for PDF.', error: error.message });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Access form at http://localhost:${port}/employee-joining.html`);
    console.log(`Access dashboard at http://localhost:${port}/dashboard.html`);
});
