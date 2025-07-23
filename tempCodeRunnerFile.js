const bcrypt = require('bcrypt');

const hash = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrU1V7H/.B9d0YI1SLwZ7.5Jv8JQ1W.';
const password = 'password';

bcrypt.compare(password, hash, (err, result) => {
    if (err) throw err;
    console.log('Password match:', result);  // true if matches
});
