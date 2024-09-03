// db.js
const mysql = require('mysql2');

// הגדרת החיבור למסד הנתונים
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'rotrot',
  password: 'rotrot',
  database: 'new_schema'
});

// בדיקת החיבור
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to the database!');
});

module.exports = connection;
