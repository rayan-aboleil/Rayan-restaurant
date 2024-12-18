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
app.get('/blogs', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('User not logged in.');
    }

    const query = `
        SELECT b.id AS blog_id, b.username AS blog_username, b.title, b.content, b.created_at,
               r.id AS reply_id, r.reply_content, r.username AS reply_username, r.created_at AS reply_created_at 
        FROM blogs b
        LEFT JOIN blog_replies r ON b.id = r.blog_id
        ORDER BY b.created_at DESC, r.created_at ASC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching blogs:', err);
            return res.status(500).send('Error retrieving blogs.');
        }

        // עיבוד התוצאות לקיבוץ בלוגים עם התגובות
        const blogs = results.reduce((acc, row) => {
            let blog = acc.find(b => b.id === row.blog_id);
            if (!blog) {
                blog = {
                    id: row.blog_id,
                    username: row.blog_username,
                    title: row.title,
                    content: row.content,
                    created_at: row.created_at,
                    replies: []
                };
                acc.push(blog);
            }
            if (row.reply_id) {
                blog.replies.push({
                    id: row.reply_id,
                    reply_content: row.reply_content,
                    username: row.reply_username,
                    created_at: row.reply_created_at
                });
            }
            return acc;
        }, []);

        // שליחת התוצאה לתבנית ה-EJS
        res.render('blogs.ejs', { blogs, username: req.session.username });
    });
});
app.post('/blogs', (req, res) => {
    const { title, content } = req.body; // שליפת כותרת ותוכן מהטופס

    if (!req.session.username) {
        return res.status(401).send('User not logged in.');
    }

    const username = req.session.username; // שליפת שם המשתמש מה-session
    const sqlInsert = 'INSERT INTO blogs (username, title, content) VALUES (?, ?, ?)';

    // הכנסת הפוסט לטבלת blogs
    connection.query(sqlInsert, [username, title, content], (err) => {
        if (err) {
            console.error('Error inserting blog:', err);
            return res.status(500).send('Error saving blog post.');
        }

        res.redirect('/blogs'); // הפניה לעמוד הצגת הפוסטים
    });
});
app.post('/replyblogs', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('User not logged in.');
    }

    const { blog_id, reply_content } = req.body; // קבלת ID של הבלוג ותוכן התגובה
    const username = req.session.username; // שם המשתמש מה-session

    // הוספת תגובה לטבלה blog_replies
    const insertQuery = 'INSERT INTO blog_replies (blog_id, username, reply_content, created_at) VALUES (?, ?, ?, NOW())';
    connection.query(insertQuery, [blog_id, username, reply_content], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }
        // הפניה חזרה לרשימת הבלוגים לאחר הוספת התגובה
        res.redirect('/blogs');
    });
});

app.post('/edit-blog', (req, res) => {
    const { blogId, title, content } = req.body; // שליפת הנתונים מהטופס
    const username = req.session.username; // שליפת שם המשתמש מה-session

    if (!blogId || !title || !content) {
        console.error('Missing blog data.');
        return res.status(400).send('All fields are required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('You must be logged in to edit this blog.');
    }

    // בדיקה אם הפוסט שייך למשתמש הנוכחי
    const checkOwnershipQuery = 'SELECT * FROM blogs WHERE id = ? AND username = ?';
    connection.query(checkOwnershipQuery, [blogId, username], (err, rows) => {
        if (err) {
            console.error('Error verifying blog ownership:', err);
            return res.status(500).send('Error verifying blog ownership.');
        }

        if (rows.length === 0) {
            // אם הפוסט לא שייך למשתמש
            console.error('Blog not found or does not belong to the user.');
            return res.status(403).send(`
                <html>
                <head>
                    <title>Unauthorized</title>
                </head>
                <body>
                    <h1>You are not authorized to edit this blog.</h1>
                    <button onclick="history.back()">Go Back</button>
                </body>
                </html>
            `);
        }

        // אם המשתמש הוא הבעלים, לעדכן את הפוסט
        const updateQuery = 'UPDATE blogs SET title = ?, content = ? WHERE id = ?';
        connection.query(updateQuery, [title, content, blogId], (err) => {
            if (err) {
                console.error('Error updating blog:', err);
                return res.status(500).send('Error updating blog.');
            }
            console.log(`Blog with ID ${blogId} updated.`);
            res.redirect('/blogs'); // חזרה לרשימת הבלוגים
        });
    });
});
app.post('/edit-replys', (req, res) => {
    const { replyId, reply_content } = req.body;
    const username = req.session.username; // שליפת שם המשתמש מה-session

    if (!replyId || !reply_content) {
        console.error('Missing reply data.');
        return res.status(400).send('Reply ID and reply content are required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('You must be logged in to edit a reply.');
    }

    // בדיקה אם ה-Reply שייך למשתמש הנוכחי
    const checkOwnershipQuery = 'SELECT * FROM blog_replies WHERE id = ? AND username = ?';
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
        const updateQuery = 'UPDATE blog_replies SET reply_content = ? WHERE id = ?';
        connection.query(updateQuery, [reply_content, replyId], (err) => {
            if (err) {
                console.error('Error updating reply:', err);
                return res.status(500).send('Error updating reply.');
            }
            console.log(`Reply with ID ${replyId} updated.`);
            res.redirect('/blogs'); // חזרה לדף הבלוגים
        });
    });
});

app.post('/delete-blog', (req, res) => {
    const { blogId } = req.body;
    const username = req.session.username; // נניח שהשם משתמש מאוחסן ב-session

    if (!blogId) {
        console.error('Blog ID is missing.');
        return res.status(400).send('Blog ID is required.');
    }

    if (!username) {
        console.error('User is not logged in.');
        return res.status(401).send('You must be logged in to delete a blog.');
    }

    // בדיקה אם הבלוג שייך למשתמש הנוכחי
    const checkOwnershipQuery = 'SELECT * FROM blogs WHERE id = ? AND username = ?';
    connection.query(checkOwnershipQuery, [blogId, username], (err, rows) => {
        if (err) {
            console.error('Error verifying blog ownership:', err);
            return res.status(500).send('Error verifying blog ownership.');
        }

        if (rows.length === 0) {
            // אם הבלוג לא שייך למשתמש
            console.error('Blog not found or does not belong to the user.');
            return res.status(403).send(`
                <html>
                <head>
                    <title>Unauthorized</title>
                </head>
                <body>
                    <h1>You are not authorized to delete this blog.</h1>
                    <button onclick="history.back()">Go Back</button>
                </body>
                </html>
            `);
        }

        // אם הבלוג שייך למשתמש, מחיקת התגובות הקשורות אליו
        const deleteRepliesQuery = 'DELETE FROM blog_replies WHERE blog_id = ?';
        connection.query(deleteRepliesQuery, [blogId], (err) => {
            if (err) {
                console.error('Error deleting blog replies:', err);
                return res.status(500).send('Error deleting blog replies.');
            }

            // מחיקת הבלוג עצמו לאחר מחיקת התגובות
            const deleteBlogQuery = 'DELETE FROM blogs WHERE id = ?';
            connection.query(deleteBlogQuery, [blogId], (err, result) => {
                if (err) {
                    console.error('Error deleting blog:', err);
                    return res.status(500).send('Error deleting blog.');
                }
                if (result.affectedRows === 0) {
                    return res.status(404).send('Blog not found.');
                }
                console.log(`Blog with ID ${blogId} and its replies deleted.`);
                res.redirect('/blogs'); // חזרה לדף הבלוגים
            });
        });
    });
});



// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
