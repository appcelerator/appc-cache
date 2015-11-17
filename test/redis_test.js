var should = require('should'),
	redis = require('../');

describe('redis', function () {
	this.timeout(10000);

	it('supports createClient', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://local.cloud.appctest.com:8445'
		});
		client.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			should(client.connected).be.true;
			client.end(done);
		});
	});

	it('supports both lower case and upper case commands', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		client.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			client.ECHO('OK', function (err, reply) {
				should(err).not.be.ok;
				should(reply).be.equal('OK');
				client.end(done);
			});
		});
	});

	it('supports createClient with auth_pass', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			auth_pass: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		client.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			client.end(done);
		});
	});

	it('supports createClient with auth', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		var calledBack;
		client.auth(process.env.APPC_TEST_SECRET, function () {
			calledBack = true;
		});
		client.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			should(calledBack).be.true;
			client.end(done);
		});
	});

	it('supports createClient with quit', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			auth_pass: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		client.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			client.quit(done);
		});
	});

	it('supports print', function () {
		var _consoleLog = console.log;
		var _args;
		function consoleLog() {
			_args = Array.prototype.slice.call(arguments);
		}
		console.log = consoleLog;
		redis.print(new Error('error'));
		should(_args).be.not.empty;
		console.log = _consoleLog;
		should(_args[0]).be.equal('Error: error');
		console.log = consoleLog;
		redis.print(null, 'OK');
		should(_args).be.not.empty;
		console.log = _consoleLog;
		should(_args[0]).be.equal('Reply: OK');
	});

	it('supports Buffers', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			auth_pass: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		client.echo(new Buffer('OK'), function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			client.quit(done);
		});
	});

	it('supports Buffers as file', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			auth_pass: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		var file = require('fs').readFileSync(__filename);
		client.set('file', file, function (err, reply) {
			should(err).not.be.ok;
			client.get('file', function (err, reply) {
				should(err).not.be.ok;
				should(reply).be.equal(file.toString());
				client.quit(done);
			});
		});
	});

	it('supports key as Buffer', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			auth_pass: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		client.set('foo_rand000000000000', 'OK');
		client.get(new Buffer('foo_rand000000000000'), function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.ok;
			should(reply).be.a.Buffer;
			should(reply).be.eql('OK');
			// NOTE: docs say it should come back as buffer but testing with
			// the redis client library, it comes back as string
			client.quit(done);
		});
	});

	it('should support client.server_info', function (done) {
		var client = redis.createClient({
			key: process.env.APPC_TEST_KEY,
			auth_pass: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		client.on('ready', function () {
			should(client.server_info).be.an.object;
			should(client.server_info).have.property('redis_version');
			should(client.server_info).have.property('versions');
			done();
		});
	});
});
