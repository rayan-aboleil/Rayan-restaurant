
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const express = require('express'); // ייבוא Express
const app = express(); // יצירת אובייקט האפליקציה
app.use(express.json()); // Middleware לעיבוד JSON


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
app.get('/feedbacks', (req, res) => {
    const query = `
        SELECT f.id AS feedback_id, f.username, f.rating, f.comments, f.created_at,
               r.id AS reply_id, r.reply, r.created_at AS reply_created_at 
        FROM feedback f 
        LEFT JOIN replies r ON f.id = r.feedback_id 
        ORDER BY f.created_at DESC
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Error retrieving feedbacks.');
        }

        const feedbacks = results.reduce((acc, row) => {
            let feedback = acc.find(f => f.id === row.feedback_id);
            if (!feedback) {
                feedback = {
                    id: row.feedback_id,
                    usernamename: row.username,
                    rating: row.rating,
                    comments: row.comments,
                    created_at: row.created_at,
                    replies: []
                };
                acc.push(feedback);
            }
            if (row.reply_id) {
                feedback.replies.push({
                    id: row.reply_id,
                    reply: row.reply,
                    created_at: row.reply_created_at
                });
            }
            return acc;
        }, []);

        res.render('feedback.ejs', { feedbacks });
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
    const sql = 'INSERT INTO feedback ( username, Comments, rating) VALUES (?, ?, ?)';
    connection.query(sql, [ username, Comments, rating], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }
        res.redirect('/');
    });
});





app.post('/reply', (req, res) => {
    const { feedbackId, reply } = req.body;

    // הכנס את התגובה לטבלת תגובות
    const query = 'INSERT INTO replies (feedback_id, reply) VALUES (?, ?)';
    connection.query(query, [feedbackId, reply], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }
        res.redirect('/feedbacks');  // הפניה חזרה לדף הפידבקים
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
