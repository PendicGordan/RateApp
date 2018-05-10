var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy; // strategy for localhost
var FacebookStrategy = require('passport-facebook').Strategy; // strategy for facebook
var secret = require('../secrets/secrets');

var User = require('../models/user');

passport.serializeUser((user, done) => {
  done(null, user.id); // user.id from the session will be used to retrieve data from db
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Signing in
passport.use('local.signup', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true
}, (req, email, password, done) => {
   User.findOne({'email': email}, (err, user) => {
     if(err) return done(); // connection failure, db not existing

     if(user) return done(null, false, req.flash('error', 'User with that email already exists')); // user already exists

     var newUser = new User();
     // passing data from the signup
     newUser.fullname = req.body.fullname;
     newUser.email = req.body.email;
     newUser.password = newUser.encryptPassword(req.body.password); // function from user.js
     newUser.save((err) => {
       return done(null, newUser); // if all is good
     });
   })
}));

// Logging in
passport.use('local.login', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true
}, (req, email, password, done) => {
   User.findOne({'email': email}, (err, user) => {
     if(err) return done(); // connection failure, db not existing

     var messages = [];
     if(!user || !user.validPassword(password)) {
       messages.push("Email doesn't exist or password is not valid!");
       return done(null, false, req.flash('error', messages)); // user already exists
     }
     return done(null, user);
   })
}));


passport.use(new FacebookStrategy(secret.facebook, (req, toke, refreshToken, profile, done) => {
  User.findOne({facebook: profile.id}, (err, user) => {
    if(err) {
      return done(err);
    }

    if(user) {
      return done(null, user);
    } else {
      var newUser = new User();
      newUser.facebook = profile.id;
      newUser.fullname = profile.displayName;
      newUser.email = profile._json.email; // ._json.firstname, _json.lastname
      newUser.tokens.push({token: token});

      newUser.save((err) => {
        return done(null, newUser);
      });
    }
  })
}));
