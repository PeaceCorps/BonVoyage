/* jshint node: true */
'use strict';

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var views = require('./routes/views');
var api = require('./routes/api');
var app = express();
var passport = require('passport');
var session = require('express-session');
var flash    = require('connect-flash');
var Access = require('./config/access');
var multer = require('multer');
var upload = multer({
	dest: 'uploads/users/',
	limits: {
		// 1MB is default file size already
	},
	fileFilter: function (req, filename, cb) {
		if (filename && filename.originalname &&
			filename.originalname.match(/\.csv$/g) !== null) {
			cb(null, true);
		} else {
			cb(null, false);
		}
	},
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true,
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

// required for passport
app.use(session({ secret: process.env.SESSION_SECRET }));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// Pass the access level to our Jade templates
app.use(function (req, res, next) {
	res.locals.user = req.user;
	res.locals.env = process.env.NODE_ENV || 'dev';
	return next();
});

// Force https
if (process.env.NODE_ENV == 'production') {
	app.use(function (req, res, next) {
		if (req.headers['x-forwarded-proto'] !== 'https') {
			return res.redirect(['https://', req.get('Host'), req.url].join(''));
		}

		return next();
	});
}

mongoose.connect(process.env.DATABASE_URL);
mongoose.connection.on('error', function (err) {
	if (err) {
		console.log(err);
	}
});

require('./config/passport.js')(passport); // pass passport for configuration

// middleware to ensure the user is authenticated.
// If not, redirect to login page.
function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	} else {
		res.redirect('/login');
	}
}

// middleware to redirect the user to the dashboard if they already logged in
function isNotLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		res.redirect('/dashboard');
	} else {
		return next();
	}
}

// middleware to check if the user is at least that access level
function needsAccess(access) {
	return function (req, res, next) {
		if (req.user && req.user.access >= access) {
			next();
		} else {
			res.status(401).send('Unauthorized');
		}
	};
}

// Route Parameters
app.param('requestId', api.handleRequestId);

// Render Views
app.get('/', views.index);
app.get('/login', isNotLoggedIn, views.renderLogin);
app.get('/register/:token', isNotLoggedIn, views.renderRegister);
app.get('/reset', isNotLoggedIn, views.renderReset);
app.get('/reset/:token', views.renderValidReset);
app.get('/dashboard', isLoggedIn,
	needsAccess(Access.VOLUNTEER), views.renderDashboard);
app.get('/dashboard/submit', isLoggedIn,
	needsAccess(Access.VOLUNTEER), views.renderSubform);
app.get('/requests/:requestId', isLoggedIn,
	needsAccess(Access.VOLUNTEER), views.renderApproval);
app.get('/requests/:requestId/edit', isLoggedIn,
	needsAccess(Access.VOLUNTEER), views.renderEditRequest);
app.get('/users', isLoggedIn, views.renderUsers);
app.get('/users/add', isLoggedIn,
	needsAccess(Access.STAFF), views.renderAddUsers);
app.get('/profile/:userId?', isLoggedIn,
	needsAccess(Access.VOLUNTEER), views.renderProfile);

// API
app.get('/api/requests', isLoggedIn,
	needsAccess(Access.VOLUNTEER), api.getRequests);

app.get('/api/users', isLoggedIn,
	needsAccess(Access.STAFF), api.getUsers);

app.post('/api/requests/:requestId/approve', isLoggedIn,
	needsAccess(Access.STAFF), api.postApprove);
app.post('/api/requests/:requestId/deny', isLoggedIn,
	needsAccess(Access.STAFF), api.postDeny);
app.post('/api/requests/:requestId/comments', isLoggedIn,
	needsAccess(Access.VOLUNTEER), api.postComments);
app.post('/profile/:userId?', isLoggedIn,
	needsAccess(Access.VOLUNTEER), api.modifyProfile);

app.post('/api/register', passport.authenticate('local-signup', {
	successRedirect: '/dashboard',
	failureRedirect: '/login',
	failureFlash: true,
}));
app.post('/api/login', passport.authenticate('local-login', {
	successRedirect: '/dashboard',
	failureRedirect: '/login',
	failureFlash: true,
}));
app.post('/api/logout', api.logout);
app.post('/api/reset', api.reset);
app.post('/api/reset/:token', api.resetValidator);
app.post('/api/requests', isLoggedIn,
	needsAccess(Access.VOLUNTEER), api.postRequest);
app.post('/api/requests/:requestId', isLoggedIn,
	needsAccess(Access.VOLUNTEER), api.postUpdatedRequest);
app.post('/api/access', isLoggedIn,
	needsAccess(Access.STAFF), api.modifyAccess);
app.post('/api/users', isLoggedIn,
	needsAccess(Access.STAFF), api.postUsers);
app.post('/api/users/validate', isLoggedIn,
	needsAccess(Access.STAFF), upload.single('users'), api.validateUsers);

app.delete('/api/requests/:requestId/delete', isLoggedIn,
	needsAccess(Access.VOLUNTEER), api.deleteRequest);
app.delete('/api/users', isLoggedIn, api.deleteUser);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

/* error handlers */

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function (err, req, res) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err,
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {},
	});
});

module.exports = app;
