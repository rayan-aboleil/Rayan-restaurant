// db.js
const mysql = require('mysql');

// הגדרת החיבור למסד הנתונים
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'rayan'
});

// בדיקת החיבור
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to the database!');
});

     module.exports = connection;
