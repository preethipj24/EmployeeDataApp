// server.js
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
const safeParseJSON = (jsonString) => {
    // Convert to string in case it's a number or other non-string type that might be trimmed
    const str = String(jsonString || '').trim(); // Ensure it's a string and trim whitespace
    if (str === '') {
        return []; // Return empty array for null, undefined, or empty/whitespace-only strings
    }
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : []; // Ensure it's an array, or default to empty
    } catch (e) {
        console.error('Error parsing JSON string:', `"${str}"`, e); // Log the problematic string with quotes
        return []; // Return empty array on parsing error
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

        // Generate HTML for PDF (this is a simplified example, you'll need to build a proper HTML structure)
        // Ideally, you'd have a separate template file for this.
        let pdfHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee Details - ${employeeData.first_name} ${employeeData.last_name}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <!-- Bootstrap 5 CSS -->
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body {
                        font-family: 'Inter', sans-serif; /* Using Inter font as per instructions */
                        padding: 2rem;
                    }
                    .container {
                        max-width: 960px; /* Adjust as needed for PDF layout */
                        margin: 0 auto;
                        padding: 2rem;
                    }
                    h2 {
                        text-align: center;
                        margin-bottom: 1.5rem;
                        font-size: 2rem;
                        font-weight: bold;
                        text-decoration: underline;
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
                        font-size: 11pt; /* Match original HTML font size */
                    }
                    th {
                        background-color: #f0f0f0;
                    }
                    /* Ensure inputs inside table cells don't have their own borders in PDF */
                    table input, table select {
                        border: none !important;
                    }
                    .signature-canvas {
                        border: 1px solid #000;
                        background-color: #fff;
                    }
                    img { /* For signature image */
                        max-width: 200px;
                        height: auto;
                        border: 1px solid #ccc;
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
                        <p>${employeeData.date_of_birth ? new Date(employeeData.date_of_birth).toLocaleDateString() : ''}</p>
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

                    <hr>

                    <div class="form-section">
                        <strong>Dependents Details (Mandatory):</strong>
                        <table class="w-full border border-gray-400 rounded-md overflow-hidden" style="table-layout: fixed;">
                            <thead>
                                <tr class="bg-gray-100">
                                    <th class="w-[5%]">SL. No</th>
                                    <th class="w-[15%]">Name</th>
                                    <th class="w-[20%]">Relationship<br>With Employee</th>
                                    <th class="w-[15%]">Date of<br>Birth of Dependent</th>
                                    <th class="w-[25%]">Permanent Address</th>
                                    <th class="w-[20%]">Contact Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employeeData.dependents_details && employeeData.dependents_details.length > 0 ?
                                    employeeData.dependents_details.map((dep, index) => `
                                        <tr>
                                            <td>${index + 1}.</td>
                                            <td>${dep.name || ''}</td>
                                            <td>${dep.relationship || ''}</td>
                                            <td>${dep.dob || ''}</td>
                                            <td>${dep.address || ''}</td>
                                            <td>${dep.contact || ''}</td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="6" class="text-center">No Dependent Details</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="form-section">
                        <strong>Highest Education:</strong>
                        <p>${employeeData.highest_education || ''}</p>
                    </div>

                    <hr>
                    <div class="form-section">
                        <table class="w-full border border-gray-400 rounded-md overflow-hidden" style="table-layout: fixed;">
                            <thead>
                                <tr class="bg-gray-100">
                                    <th class="w-[10%]">S.No.</th>
                                    <th class="w-[20%]">Qualification</th>
                                    <th class="w-[30%]">University & College<br>(Fill Both the Details)</th>
                                    <th class="w-[20%]">Year of Passing</th>
                                    <th class="w-[20%]">Percentage % Obtained</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employeeData.education_details && employeeData.education_details.length > 0 ?
                                    employeeData.education_details.map((edu, index) => `
                                        <tr>
                                            <td>${index + 1}.</td>
                                            <td>${edu.qualification || ''}</td>
                                            <td>${edu.university_college || ''}</td>
                                            <td>${edu.year_of_passing || ''}</td>
                                            <td>${edu.percentage || ''}</td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="5" class="text-center">No Education Details</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="form-section">
                        <strong>Work Experiences (If any):</strong>
                        <table class="w-full border border-gray-400 rounded-md overflow-hidden" style="table-layout: fixed;">
                            <thead>
                                <tr class="bg-gray-100">
                                    <th class="w-[5%]">S.No.</th>
                                    <th class="w-[20%]">Organization</th>
                                    <th class="w-[15%]">Department</th>
                                    <th class="w-[15%]">Designation</th>
                                    <th class="w-[15%]">Start Date<br>(Mandatory)</th>
                                    <th class="w-[15%]">End Date<br>(Mandatory)</th>
                                    <th class="w-[15%]">Salary Drawn</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employeeData.work_experience_details && employeeData.work_experience_details.length > 0 ?
                                    employeeData.work_experience_details.map((exp, index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${exp.organization || ''}</td>
                                            <td>${exp.department || ''}</td>
                                            <td>${exp.designation || ''}</td>
                                            <td>${exp.start_date || ''}</td>
                                            <td>${exp.end_date || ''}</td>
                                            <td>${exp.salary || ''}</td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="7" class="text-center">No Work Experience Details</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="form-section mt-8">
                        <strong>Declaration:</strong>
                        <p class="mt-2 leading-relaxed">
                            I hereby declare that the information given above is correct and true to the best of my knowledge.
                            I understand that any misrepresentation of facts may be called for disciplinary action.
                        </p>

                        <table class="w-full mt-8 text-base" style="border: none;">
                            <tr style="border: none;">
                                <td class="w-1/2 p-2" style="border: none;">
                                    <label class="block font-bold mb-1">Date:</label>
                                    <p>${employeeData.declaration_date ? new Date(employeeData.declaration_date).toLocaleDateString() : ''}</p>
                                </td>
                                <td class="w-1/2 p-2" style="border: none;">
                                    <label class="block font-bold mb-1">Place:</label>
                                    <p>${employeeData.declaration_place || ''}</p>
                                </td>
                            </tr>
                            <tr style="border: none;">
                                <td colspan="2" class="p-2 pt-12 text-right" style="border: none;">
                                    <div class="form-section mt-8">
                                        <label class="block font-bold mb-2">Signature of Employee:</label>
                                        ${employeeData.signature_image_data ? `<img src="${employeeData.signature_image_data}" alt="Employee Signature" class="signature-canvas w-full max-w-md mx-auto block" style="width: 200px; height: 80px;"/>` : `<p>No signature provided.</p>`}
                                    </div>
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
