var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var loggify = require('./loggify');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({secret: 'how now brown cow', cookie: { maxAge: 1200000000 }}));


app.use(loggify);

app.get('/', 
util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/create', 
util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/links', 
util.checkUser,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
// util.checkUser,
function(req, res) {
  var uri = req.body.url;
  // console.log('we are authenticated and in /links POST');
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

// LOGIN

app.get('/login', 
function(req, res) {
  res.render('login');
});

app.post('/login', 
function(req, res) {
  // console.log(req.body.username);
  // console.log(req.body.password);
  new User({username: req.body.username, password: req.body.password})
  .fetch()
  .then(function(user) {
    if (user) {
      //session initiated
      console.log('USER SHOULD BE REDIRECTED---------');
      req.session.regenerate(function() {
        req.session.user = req.body.username;
        res.redirect('/');
      });
      // console.log('Logging in!: ', this);
    } else {
      //redirect to login page 
      console.log('TEST FAILING HERE------------');
      res.redirect('/login');
    }
  });
});

// SIGN UP

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.post('/signup', 
function(req, res) {
  // console.log(req.body);
  // console.log(req.body.password);

  new User({username: req.body.username, password: req.body.password})
  .fetch()
  .then(function(user) {
    // console.log(user);
    if (!user) {
      console.log('about to save a user!!!: ', this);
      this.save().then(function(saveStatus) {
        console.log(saveStatus);
        req.session.regenerate(function() {
          req.session.user = req.body.username;
          res.redirect('/');
        });
      });
    } else {
      //redirect to login page 
      //res.render('/index');
      console.log('redirect');
      res.end();
    }
  });
});

// LOGOUT
app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('login');
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log('Im a star');
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
