var should = require('should'),
	express = require('express'),
	request = require('request'),
	async = require('async'),
	Cache = require('../');

describe('session', function () {
	this.timeout(10000);

	it('supports cookies', function (done) {
		var app = express();
		var session = require('express-session');
		var CacheStore = Cache.createSessionStore(session);
		var options = {
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://local.cloud.appctest.com:8445',
			ttl: 2000
		};
		app.use(session({
			store: new CacheStore(options),
			secret: 'keyboard cat',
			resave: false,
			saveUninitialized: false
		}));
		var ts = Date.now();
		app.get('/', function (req, resp, next) {
			req.session.ts = ts;
			resp.send('OK');
		});
		app.get('/1', function (req, resp, next) {
			resp.send(String(req.session.ts));
		});

		var server = app.listen(8999),
			jar = request.jar(),
			sid;

		async.series([
			function (cb) {
				request({url:'http://127.0.0.1:8999/', jar:jar}, function (err, resp, body) {
					should(err).not.be.ok;
					should(resp.headers).have.property('set-cookie');
					should(resp.headers['set-cookie']).have.length(1);
					should(resp.headers['set-cookie'][0]).match(/connect\.sid=/);
					should(body).be.equal('OK');
					sid = jar.getCookies('http://127.0.0.1')[0].value;
					should(sid).be.a.string;
					cb();
				});
			},
			function (cb) {
				request({url:'http://127.0.0.1:8999/1', jar:jar}, function (err, resp, body) {
					should(err).not.be.ok;
					should(body).be.equal(String(ts));
					var s = jar.getCookies('http://127.0.0.1')[0].value;
					should(s).be.equal(sid);
					cb();
				});
			},
			function (cb) {
				// wait for the cookie to expire and then make sure it does
				setTimeout(cb, 2000);
			},
			function (cb) {
				ts = Date.now();
				request({url:'http://127.0.0.1:8999/', jar:jar}, function (err, resp, body) {
					should(err).not.be.ok;
					should(body).be.equal('OK');
					var s = jar.getCookies('http://127.0.0.1')[0].value;
					should(s).not.be.equal(sid);
					cb();
				});
			}
		], function (err) {
			server.close();
			err && console.error(err.stack);
			done(err);
		});
	});
});
