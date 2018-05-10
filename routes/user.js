// for sending mail to the client
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var async = require('async');

var crypto = require('crypto');
var User = require('../models/user');
var secrets = require('../secrets/secrets');

module.exports = (app, passport) => {
  app.get('/', (req, res, next) => {
    if(req.session.cookie.originalMaxAge !== null) {
      res.redirect('/home');
    } else {
      res.render('index', {title: 'Index || RateMe'});
    }
    // note: can be implemented with passport
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.get('/signup', (req, res) => {
    var errors = req.flash('error');
    res.render('user/signup', {title: 'Sign Up || RateMe', messages: errors, hasErrors: errors.length > 0});
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.post('/signup', signupValidation, passport.authenticate('local.signup', {
    successRedirect: '/home',
    failureRedirect: '/signup',
    failureFlash: true
  }));
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.post('/login', loginValidation, passport.authenticate('local.login', {
    //successRedirect: '/home',
    failureRedirect: '/login',
    failureFlash: true
  }), (req, res) => {
    if(req.body.rememberme) {
      req.session.cookie.maxAge = 30*24*60*60*1000; // 30 days
    } else {
      req.session.cookie.expires = null;
    }
    res.redirect('/home');
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.get('/auth/facebook', passport.authenticate('facebook', {scope: 'email'}));

  app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/home',
    failureRedirect: '/login',
    failureFlash: true
  }));
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.get('/login', (req, res) => {
    var errors = req.flash('error');
    res.render('user/login', {title: 'Login || RateMe', messages: errors, hasErrors: errors.length > 0});
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.get('/home', (req, res) => {
    res.render('home', {title: 'Home || RateMe'});
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  app.get('/forgot', (req, res) => {
    var errors = req.flash('error');
    var info = req.flash('info');
    res.render('user/forgot', {title: 'Request password reset', messages: errors, hasErrors: errors.length > 0,
                                                                info: info, noErrors: info.length > 0});
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // sending an e-mail to the user
  app.post('/forgot', (req, res, next) => {
    // generates token
    async.waterfall([
      function(callback) {
        crypto.randomBytes(20, (err, buf) => {
          var rand = buf.toString('hex');
          callback(err, rand);
        });
      },
      // checking if user's email existing in database
      function(rand, callback) {
        User.findOne({'email': req.body.email}, (err, user) => {

          if(!user) { // if user is not found by email in db
            req.flash('error', 'There is no account with that email or email is not valid.');
            return res.redirect('/forgot');
          }

          // user data is in user object
          user.passwordResetToken = rand;
          user.passwordResetExpires = Date.now() + 60*60*1000; // user can reset password in 1 hour

          // saving user's passwordResetToken
          user.save((err) => {
            callback(err, rand, user);
          });
        })
      },

      function(rand, user, callback) {
        var smtpTransport = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: secrets.auth.user, // email the message is come from
            pass: secrets.auth.pass
          }
        });

        // email options
        var mailOptions = {
          to: user.email,
          from: 'RateMe ' + '<' + secrets.auth.user + '>', // 'RateMe ' + '<me@gmail.com>'
          subject: 'RateMe Application reset token for password',
          text: 'You have requested the password reset token.\n\n' +
                'Please click the link to complete the process:\n\n' +
                'http://localhost:3000/reset/' + rand + '\n\n' // http://localhost/reset/saddasdasdasdsad
        };

        // sending an email to the given email
        smtpTransport.sendMail(mailOptions, (err, response) => {
          // email sent successfully
          req.flash('info', 'A password reset token has been sent to ' + user.email);
          return callback(err, user);
        });
      }
    ], (err) => {
      if(err) {
        return next(err);
      }

      res.redirect('/forgot');
    });
  });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    app.get('/reset/:token', (req, res) => {
      User.findOne({passwordResetToken: req.params.token, passwordResetExpires: { $gt: Date.now()}}, (err, user) => {
        if(!user) {
          req.flash('error', 'Password reset token has expired or is invalid. Enter your e-mail again.');
          return res.redirect('/forgot');
        }
        var errors = req.flash('error');
        var success = req.flash('success');
        //req.flash();
        res.render('user/reset', {title: 'Reset your password', messages: errors, hasErrors: errors.length > 0,
                                                                success: success, noErrors: success.length > 0});
      });
    });

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // resetting form
  app.post('/reset/:token', (req, res) => {
      async.waterfall([
        function(callback) {
          User.findOne({passwordResetToken: req.params.token, passwordResetExpires: { $gt: Date.now()}}, (err, user) => {
            if(!user) {
              req.flash('error', 'Password reset token has expired or is invalid. Enter your e-mail again.');
              return res.redirect('/forgot');
            }
            req.checkBody('password', 'Password is required!').notEmpty();
            req.checkBody('password', 'Password must contain at least 5 characters!').matches(/^([1-zA-Z0-1@.\s]{5,255})$/, "i");
            var errors = req.validationErrors();

            if(req.body.password == req.body.cpassword) {
              if(errors) {  // there are errors on form, calling form once again and displaying messages
                var messages = [];
                errors.forEach((error) => {
                  messages.push(error.msg);
                });
                var errors = req.flash('error');
                res.redirect('/reset/' + req.params.token);
              } else { // everyyhing ok, resetting and saving password to the db
                user.password = user.encryptPassword(req.body.password);
                // resetting password 'token' and 'expires' because we are finished with them
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;


                user.save((err) => {
                  req.flash('success', 'Your password has been successfully updated.');
                  callback(err, user); // callback for sending a confirmation e-mail to the user
                })
              }
            } else { // passwords are not equal, redirecting on the form once again
              req.flash('error', 'Password and confirm password are not equal.');
              res.redirect('/reset/' + req.params.token);
            }
          });
        },

        function(user, callback) {
          var smtpTransport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: secrets.auth.user, // email the message is come from
              pass: secrets.auth.pass
            }
          });

          // email options
          var mailOptions = {
            to: user.email,
            from: 'RateMe ' + '<' + secrets.auth.user + '>', // 'RateMe ' + '<me@gmail.com>'
            subject: 'Your password has been changed',
            text: 'Your(' + user.email + ': ' + user.fullname + ') password has been successfuly changed\n\n' +
                  'This is an automatical sent message. Please do not reply...'
          };

          // sending an email to the given email
          smtpTransport.sendMail(mailOptions, (err, response) => {
            callback(err, user);

            var error = req.flash('error');
            var success = req.flash('success');

            res.render('user/reset', {title: 'Reset your password', messages: error, hasErrors: error.length > 0,
                                                                    success: success, noErrors: success.length > 0 });
          });
        }
      ])
    });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    app.get('/logout', (req, res) => {
      req.logout(); // passport!
      req.session.destroy((err) => {
        res.redirect('/');
      });
    });
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// sign up validation
function signupValidation(req, res, next) {
  req.checkBody('fullname', 'Fullname is required!').notEmpty();
  req.checkBody('fullname', 'Fullname length cannot be less than 3!').isLength({min: 3});
  req.checkBody('email',    'Email is required!').notEmpty();
  req.checkBody('email',    'Email is invalid!').isEmail();
  req.checkBody('password', 'Password is required!').notEmpty();
  req.checkBody('password', 'Password must contain at least 5 characters!').matches(/^([1-zA-Z0-1@.\s]{5,255})$/, "i");

  var errors = req.validationErrors();

  if(errors) {
    var messages = [];
    errors.forEach((error) => {
      messages.push(error.msg);
    });

    req.flash('error', messages); // req will have all error messages
    res.redirect('/signup');
  } else {
    return next(); // moving to the next callback
  }
}

// login validation
function loginValidation(req, res, next) {
  req.checkBody('email',    'Email is required!').notEmpty();
  req.checkBody('email',    'Email is invalid!').isEmail();
  req.checkBody('password', 'Password is required!').notEmpty();
  req.checkBody('password', 'Password must contain at least 5 characters!').matches(/^([1-zA-Z0-1@.\s]{5,255})$/, "i");

  var errors = req.validationErrors();

  if(errors) {
    var messages = [];
    errors.forEach((error) => {
      messages.push(error.msg);
    });

    req.flash('error', messages); // req will have all error messages

    res.redirect('/login');
  } else {
    return next(); // moving to the next callback
  }
}
