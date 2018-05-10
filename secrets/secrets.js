// important key and values which are public
module.exports = {
  auth: {
    user: 'gordan.pendic5@gmail.com',
    pass: '2431996fkbask'
  },
  facebook: {
    clientID: '1750817778335954',
    clientSecret: 'a03845ab1d0cfc671e946e257ab3457f',
    profileFields: ['email', 'displayName'],
    callbackURL: 'http://localhost:3000/auth/facebook/callback',
    passReqToCallback: true
  }
};
