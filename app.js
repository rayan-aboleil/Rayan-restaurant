// app.js

const express = require('express');
const connection = require('./db');

const app = express();

// הגדרת נתיב שמחזיר את הנתונים מהטבלה למסך בדפדפן
app.get('/data', (req, res) => {
  connection.query('rayan.users', (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error fetching data');
    } else {
      res.json(results); // שליחת הנתונים כ-JSON ל-Frontend
    }  
  });
});

// הפעלת השרת על פורט 3000
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

