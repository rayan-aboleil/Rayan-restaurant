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
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Ensure secure cookies in production
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
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to the database.');
});
// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Login route
app.post('/db.js', (req, res) => {
    const { username, password, email } = req.body;

    const query = 'SELECT * FROM project WHERE username = ? AND password = ? AND email = ?';
    connection.query(query, [username, password, email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.session.username = username;
            console.log('Login OK');
            res.redirect('/index.html'); // הפניה לדף index.html
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

// Feedbacks route
app.get('/feedbacks', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('User not logged in.');
    }

    const query = `
        SELECT f.id AS feedback_id, f.username AS feedback_username, f.rating, f.Comments, f.created_at,
               r.id AS reply_id, r.reply, r.username AS reply_username, r.created_at AS reply_created_at 
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
                    username: row.feedback_username,
                    rating: row.rating,
                    Comments: row.Comments,
                    created_at: row.created_at,
                    replies: []
                };
                acc.push(feedback);
            }
            if (row.reply_id) {
                feedback.replies.push({
                    id: row.reply_id,
                    reply: row.reply,
                    username: row.reply_username, // Add username to reply
                    created_at: row.reply_created_at
                });
            }
            return acc;
        }, []);

        res.render('feedback.ejs', { feedbacks, username: req.session.username });
    });
});






app.post('/feedback', (req, res) => {
    const { Comments, rating } = req.body;

    if (!req.session.username) {
        return res.status(401).send('User not logged in.');
    }

    const username = req.session.username; // Retrieve username from session
    const sqlInsert = 'INSERT INTO feedback (username, Comments, rating) VALUES (?, ?, ?)';
    connection.query(sqlInsert, [username, Comments, rating], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }

        res.redirect('/feedbacks');
    });
});


// Add reply route
// Add reply route
app.post('/reply', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('User not logged in.');
    }

    const { feedbackId, reply } = req.body;
    const username = req.session.username; // Retrieve username from session

    // Insert reply into the database
    const insertQuery = 'INSERT INTO replies (feedback_id, reply, username) VALUES (?, ?, ?)';
    connection.query(insertQuery, [feedbackId, reply, username], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }
        // Redirect back to the feedbacks page after successful insertion
        res.redirect('/feedbacks');
    });
});




app.post('/edit-feedback', (req, res) => {
    const { feedbackId, Comments, rating } = req.body;
    const username = req.session.username; // נניח שהשם משתמש מאוחסן ב-session

    if (!feedbackId || !Comments || !rating) {
        console.error('Missing feedback data.');
        return res.status(400).send('All fields are required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('You must be logged in to edit feedback.');
    }

    // בדיקה אם ה-FEEDBACK שייך למשתמש הנוכחי
    const checkOwnershipQuery = 'SELECT * FROM feedback WHERE id = ? AND username = ?';
    connection.query(checkOwnershipQuery, [feedbackId, username], (err, rows) => {
        if (err) {
            console.error('Error verifying feedback ownership:', err);
            return res.status(500).send('Error verifying feedback ownership.');
        }

        if (rows.length === 0) {
            // אם ה-FEEDBACK לא שייך למשתמש
            console.error('Feedback not found or does not belong to the user.');
            return res.status(403).send(`
                <html>
                <head>
                    <title>Unauthorized</title>
                </head>
                <body>
                    <h1>You are not authorized to edit this feedback.</h1>
                    <button onclick="history.back()">Go Back</button>
                </body>
                </html>
            `);
        }

        // אם המשתמש הוא הבעלים, לעדכן את ה-FEEDBACK
        const updateQuery = 'UPDATE feedback SET Comments = ?, rating = ? WHERE id = ?';
        connection.query(updateQuery, [Comments, rating, feedbackId], (err) => {
            if (err) {
                console.error('Error updating feedback:', err);
                return res.status(500).send('Error updating feedback.');
            }
            console.log(`Feedback with ID ${feedbackId} updated.`);
            res.redirect('/feedbacks'); // חזרה לדף הפידבקים
        });
    });
});


app.post('/edit-reply', (req, res) => {
    const { replyId, reply } = req.body;
    const username = req.session.username; // נניח שהשם משתמש מאוחסן ב-session

    if (!replyId || !reply) {
        console.error('Missing reply data.');
        return res.status(400).send('Reply ID and reply text are required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('You must be logged in to edit a reply.');
    }

    // בדיקה אם ה-Reply שייך למשתמש הנוכחי
    const checkOwnershipQuery = 'SELECT * FROM replies WHERE id = ? AND username = ?';
    connection.query(checkOwnershipQuery, [replyId, username], (err, rows) => {
        if (err) {
            console.error('Error verifying reply ownership:', err);
            return res.status(500).send('Error verifying reply ownership.');
        }

        if (rows.length === 0) {
            // אם ה-Reply לא שייך למשתמש
            console.error('Reply not found or does not belong to the user.');
            return res.status(403).send(`
                <html>
                <head>
                    <title>Unauthorized</title>
                </head>
                <body>
                    <h1>You are not authorized to edit this reply.</h1>
                    <button onclick="history.back()">Go Back</button>
                </body>
                </html>
            `);
        }

        // אם המשתמש הוא הבעלים, לעדכן את ה-Reply
        const updateQuery = 'UPDATE replies SET reply = ? WHERE id = ?';
        connection.query(updateQuery, [reply, replyId], (err) => {
            if (err) {
                console.error('Error updating reply:', err);
                return res.status(500).send('Error updating reply.');
            }
            console.log(`Reply with ID ${replyId} updated.`);
            res.redirect('/feedbacks'); // חזרה לדף הפידבקים
        });
    });
});


app.post('/delete-feedback', (req, res) => {
    const { feedbackId } = req.body;
    const username = req.session.username; // נניח שהשם משתמש מאוחסן ב-session

    if (!feedbackId) {
        console.error('Feedback ID is missing.');
        return res.status(400).send('Feedback ID is required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('You must be logged in to delete feedback.');
    }

    // בדיקה אם הפידבק שייך למשתמש הנוכחי
    const checkOwnershipQuery = 'SELECT * FROM feedback WHERE id = ? AND username = ?';
    connection.query(checkOwnershipQuery, [feedbackId, username], (err, rows) => {
        if (err) {
            console.error('Error verifying feedback ownership:', err);
            return res.status(500).send('Error verifying feedback ownership.');
        }

        if (rows.length === 0) {
            // אם הפידבק לא שייך למשתמש
            console.error('Feedback not found or does not belong to the user.');
            return res.status(403).send(`
                <html>
                <head>
                    <title>Unauthorized</title>
                </head>
                <body>
                    <h1>You are not authorized to delete this feedback.</h1>
                    <button onclick="history.back()">Go Back</button>
                </body>
                </html>
            `);
        }

        // אם הפידבק שייך למשתמש, מחיקת התגובות הקשורות אליו
        const deleteRepliesQuery = 'DELETE FROM replies WHERE feedback_id = ?';
        connection.query(deleteRepliesQuery, [feedbackId], (err) => {
            if (err) {
                console.error('Error deleting replies:', err);
                return res.status(500).send('Error deleting replies.');
            }

            // מחיקת הפידבק עצמו לאחר מחיקת התגובות
            const deleteFeedbackQuery = 'DELETE FROM feedback WHERE id = ?';
            connection.query(deleteFeedbackQuery, [feedbackId], (err, result) => {
                if (err) {
                    console.error('Error deleting feedback:', err);
                    return res.status(500).send('Error deleting feedback.');
                }
                if (result.affectedRows === 0) {
                    return res.status(404).send('Feedback not found.');
                }
                console.log(`Feedback with ID ${feedbackId} and its replies deleted.`);
                res.redirect('/feedbacks'); // חזרה לדף הפידבקים
            });
        });
    });
});



app.post('/delete-reply', (req, res) => {
    const { replyId } = req.body;
    const username = req.session.username; // Assuming the username is stored in the session.

    if (!replyId) {
        console.error('Reply ID is missing.');
        return res.status(400).send('Reply ID is required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('User not authorized.');
    }

    // Check if the reply belongs to the logged-in user
    const checkOwnershipQuery = 'SELECT * FROM replies WHERE id = ? AND username = ?';
    connection.query(checkOwnershipQuery, [replyId, username], (err, rows) => {
        if (err) {
            console.error('Error verifying reply ownership:', err);
            return res.status(500).send('Error verifying reply ownership.');
        }

        if (rows.length === 0) {
            console.error('Reply not found or does not belong to the user.');
            return res.status(403).send(`
                <html>
                <head>
                    <title>Unauthorized</title>
                </head>
                <body>
                    <h1>You are not authorized to delete this reply.</h1>
                    <button onclick="history.back()">Go Back</button>
                </body>
                </html>
            `);
        }

        // Proceed to delete the reply
        const deleteReplyQuery = 'DELETE FROM replies WHERE id = ?';
        connection.query(deleteReplyQuery, [replyId], (err, result) => {
            if (err) {
                console.error('Error deleting reply:', err);
                return res.status(500).send('Error deleting reply.');
            }
            console.log(`Reply with ID ${replyId} deleted.`);
            res.redirect('/feedbacks'); // Redirect to the feedbacks page
        });
    });
});

app.get('/view-feedbacks', (req, res) => {
    const query = 'SELECT * FROM feedback ORDER BY created_at DESC';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Error retrieving feedbacks.');
        }

        res.render('view-feedbacks.ejs', { feedbacks: results }); // Ensure this EJS file exists
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


app.get('/view-feedbacks', (req, res) => {
    const query = 'SELECT * FROM feedback ORDER BY created_at DESC';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Error retrieving feedbacks.');
        }

        res.render('view-feedbacks.ejs', { feedbacks: results }); // Ensure this EJS file exists
    });
});
app.get('/view', (req, res) => {
    const query = 'SELECT * FROM feedback ORDER BY created_at DESC';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Error retrieving feedbacks.');
        }

        res.render('Viewfee.ejs', { feedbacks: results }); // Ensure this EJS file exists
    });
});



// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
