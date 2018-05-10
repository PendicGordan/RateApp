var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var validator = require('express-validator'); // enables validating a form
var ejs = require('ejs');
var engine = require('ejs-mate'); // reusing templates in projects
var session = require('express-session');
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(session); // save session values in database
var flash = require('connect-flash');
var passport = require('passport');

var app = express();

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/rateme');

require('./config/passport');
require('./secrets/secrets');

app.use(express.static('public'));

app.set('port', process.env.PORT || 3000);
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

// important: after middleware for bodyParser
app.use(validator());

// !
app.use(session({
  secret: 'testkey',
  resave: false,
  saveUninitialized: false,
  httpOnly: true,
  store: new MongoStore({mongooseConnection: mongoose.connection}),
  cookie: { secure: false }
}));

// for passport express-session connect-mongo(above), passport, connect-flash
// + middleware app.use(session), app.use(flash()), app.use(passport.initialize()), app.use(passport.session())
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

require('./routes/user')(app, passport);

// for secure connection
var fs = require('fs');
var https = require('https');
var path = require('path');

const httpsOptions = {
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'localhost.crt')),
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'localhost.key'))
};

https.createServer(httpsOptions, app).listen(3000, function() {
  console.log('Listening on port 3000');
});

/*app.listen(3000, function() {
  console.log('Listening on port 3000');
});*/
