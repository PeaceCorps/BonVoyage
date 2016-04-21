/* jshint node: true */
'use strict';

var express = require('express');
var path = require('path');
var fs = require('fs');
var morganLog = fs.createWriteStream(__dirname + '/tests/tests.log');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var views = require(__dirname + '/routes/views');
var api = require(__dirname + '/routes/api');
var app = express();
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
var Access = require(__dirname + '/config/access');
var multer = require('multer');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var upload = multer({
	dest: __dirname + '/uploads/users/',
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
if (process.env.NODE_ENV == 'test') {
	app.use(logger('dev', { stream: morganLog }));
} else {
	app.use(logger('dev'));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true,
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

function getConnectionString() {
	switch (process.env.NODE_ENV) {
		case 'production':
			return process.env.MONGO_PROD_CONNECTION_STRING;
		case 'test':
			return process.env.MONGO_TEST_CONNECTION_STRING;
		case 'development':
			return process.env.MONGO_DEV_CONNECTION_STRING;
	}
}

mongoose.connect(getConnectionString());
mongoose.connection.on('error', function (err) {
	console.log(err);
});

var MongoStore = require('connect-mongo')(session);

app.use(session({
	secret: process.env.SESSION_SECRET,
	store: new MongoStore({
		mongooseConnection: mongoose.connection,
	}),
	resave: false,
	saveUninitialized: true,
}));

// required for passport
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// Pass the access level to our Jade templates
app.use(function (req, res, next) {
	var u = req.user;
	if (u) {
		delete u.hash;
	}

	res.locals.user = u;
	res.locals.env = process.env.NODE_ENV || 'dev';
	return next();
});

// Force https -- need SSL cert first to support custom domain
// if (process.env.NODE_ENV == 'production') {
// 	app.use(function (req, res, next) {
// 		if (req.headers['x-forwarded-proto'] !== 'https') {
// 			return res.redirect(['https://', req.get('Host'), req.url].join(''));
// 		}
//
// 		return next();
// 	});
// }

// pass passport for configuration
require(__dirname + '/config/passport.js')(passport);

// middleware to redirect the user to the dashboard if they already logged in
function isNotLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		res.redirect('/dashboard');
	} else {
		return next();
	}
}

// middleware to check if the user is at least that access level
function needsAccess(access, doRedirect) {
	doRedirect = doRedirect || false;
	return function (req, res, next) {
		if (req.user && req.user.access >= access) {
			next();
		} else {
			if (doRedirect) {
				req.flash('dashboardFlash', {
					text: 'You do not have access to this page.',
					class: 'danger',
				});
				res.redirect('/dashboard');
			} else {
				res.status(401).send('Unauthorized');
			}
		}
	};
}

// Render Views
app.get('/', views.index);
app.get('/login', isNotLoggedIn, views.renderLogin);
app.get('/register/:email/:token', isNotLoggedIn, views.renderRegister);
app.get('/reset', isNotLoggedIn, views.renderReset);
app.get('/reset/:token', isNotLoggedIn, views.renderValidReset);
app.get('/dashboard', ensureLoggedIn('/login'), views.renderDashboard);
app.get('/dashboard/submit', ensureLoggedIn('/login'), views.renderSubform);
app.get('/requests/:requestId', ensureLoggedIn('/login'),
	api.handleRequestId, views.renderApproval);
app.get('/requests/:requestId/edit', ensureLoggedIn('/login'),
	api.handleRequestId, views.renderEditRequest);
app.get('/users', ensureLoggedIn('/login'),
	needsAccess(Access.STAFF, true), views.renderUsers);
app.get('/users/add', ensureLoggedIn('/login'),
	needsAccess(Access.STAFF, true), views.renderAddUsers);
app.get('/profile/:userId?', ensureLoggedIn('/login'), views.renderProfile);

app.get('/.well-known/acme-challenge/' +
	'AC86a1oSUu_K8DzELD-hynBDBOtms4LDqHPFXK-bQo0', function (req, res) {
	res.send('AC86a1oSUu_K8DzELD-hynBDBOtms4LDqHPFXK-bQo0.' +
		'khLTvjUppQrncGgiw9YosG-gvL4-U4ZSWH23WakFSig');
});

// API
app.get('/api/requests',
	needsAccess(Access.VOLUNTEER), api.getRequests);
app.get('/api/users',
	needsAccess(Access.VOLUNTEER), api.getUsers);
app.get('/api/warnings',
	needsAccess(Access.VOLUNTEER), api.getWarnings);

app.post('/api/requests/:requestId/approve',
	needsAccess(Access.STAFF), api.handleRequestId, api.postApprove);
app.post('/api/requests/:requestId/deny',
	needsAccess(Access.STAFF), api.handleRequestId, api.postDeny);
app.post('/api/requests/:requestId/comments',
	needsAccess(Access.VOLUNTEER), api.handleRequestId, api.postComments);
app.post('/profile/:userId?',
	needsAccess(Access.VOLUNTEER), api.modifyProfile);

app.post('/api/register', passport.authenticate('local-signup', {
	successRedirect: '/profile',
	failureRedirect: '/login',
	failureFlash: true,
}));
app.post('/api/login', passport.authenticate('local-login', {
	successRedirect: '/dashboard',
	failureRedirect: '/login',
	failureFlash: true,
}));
app.post('/api/logout',
	needsAccess(Access.VOLUNTEER), api.logout);
app.post('/api/reset', api.reset);
app.post('/api/reset/:token', api.resetValidator);
app.post('/api/requests',
	needsAccess(Access.VOLUNTEER), api.postRequest);
app.post('/api/requests/:requestId',
	needsAccess(Access.VOLUNTEER), api.handleRequestId, api.postUpdatedRequest);
app.post('/api/access',
	needsAccess(Access.STAFF), api.modifyAccess);
app.post('/api/users',
	needsAccess(Access.STAFF), api.postUsers);
app.post('/api/users/validate',
	needsAccess(Access.STAFF), upload.single('users'), api.validateUsers);

app.delete('/api/requests/:requestId/delete',
	needsAccess(Access.VOLUNTEER), api.handleRequestId, api.deleteRequest);
app.delete('/api/users',
	needsAccess(Access.VOLUNTEER), api.deleteUser);

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
