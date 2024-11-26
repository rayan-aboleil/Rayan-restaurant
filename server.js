const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key', // מפתח סודי לשימוש ב-session
    resave: false,
    saveUninitialized: true
}));

// Database connection
app.use(express.static(__dirname));
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'rotrot',
    password: 'rotrot',
    database: 'new_schema'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database.');
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Login route
app.post('/db.js', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;

    const query = 'SELECT * FROM project WHERE username = ? AND password = ? AND email = ?';
    connection.query(query, [username, password, email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // אם ההתחברות מוצלחת, נשמור את שם המשתמש ב-session
            req.session.username = username;
            console.log('Login OK');
            res.redirect('/index.html'); // הפניה לדף index1.html
        } else {
            console.log('Login failed');
            res.send('Invalid username, password, or email.');
        }
    });
});

// Register route
app.post('/register', (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;

    const checkUserQuery = 'SELECT * FROM project WHERE username = ?';
    connection.query(checkUserQuery, [username], (err, results) => {
        if (err) {
            console.error('Error checking username:', err);
            return res.status(500).send('Internal server error.');
        }

        if (results.length > 0) {
            return res.status(409).send('Username already exists');
        }

        const query = 'INSERT INTO users (firstName, lastName, username, email, password) VALUES (?, ?, ?, ?, ?)';
        connection.query(query, [firstName, lastName, username, email, password], (err) => {
            if (err) {
                console.error('Error registering user:', err);
                return res.status(500).send('Error registering user.');
            }

            req.session.username = username; // Save username in session
            res.redirect('/index.html'); // Redirect to main page
        });
    });
});
app.post('/feedback', (req, res) => {
    const {  username, Comments, rating} = req.body;

    // הכנסה לטבלה
    const sqlInsert = 'INSERT INTO feedback ( username, Comments, rating) VALUES (?, ?, ?)';
    connection.query(sqlInsert, [ username, Comments, rating], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }

        // שליפת כל הפידבקים לאחר ההוספה
        const sqlSelect = 'SELECT * FROM feedback ORDER BY created_at DESC';
        connection.query(sqlSelect, (err, results) => {
            if (err) {
                console.error('Error fetching feedback:', err);
                return res.status(500).send('Error retrieving feedback.');
            }
            res.render('feedback.ejs', { feedbacks: results });
        });
    });
});



// נתיב להוספת פידבק
app.post('/feedback', (req, res) => {
    const { username, Comments, rating} = req.body;
    const sql = 'INSERT INTO feedback1 ( username, Comments, rating) VALUES (?, ?, ?)';
    connection.query(sql, [ username, Comments, rating], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }
        res.redirect('/feedback'); // לאחר שמירת הפידבק, מפנה לדף הפידבקים
    });
});

// Contact route
app.post('/contact1', (req, res) => {
    const { name, email, phone } = req.body;

    const sql = 'INSERT INTO contact (name, email, phone) VALUES (?, ?, ?)';
    connection.query(sql, [name, email, phone], (err) => {
        if (err) {
            console.error('Error inserting contact:', err);
            return res.status(500).send('Error saving contact.');
        }
        res.send('Contact saved successfully!');
    });
});

// Get username route
app.get('/get-username', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(404).send('No user logged in.');
    }
});

// Start the server

app.listen(3000, () => {
    console.log(`Server is running on port 3000`);
});
