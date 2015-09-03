var should = require('should'),
	Cache = require('../'),
	cache;

describe('keys', function () {
	this.timeout(10000);

	before(function (done) {
		cache = new Cache({
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		// delete all the keys before starting
		cache.flushdb(done);
	});

	afterEach(function (done) {
		cache.flushdb(done);
	});

	after(function (done) {
		if (cache) {
			cache.close(done);
		} else {
			done();
		}
	});

	it('supports multi with no callback', function (done) {
		var multi = cache.multi();
		var responses = [];
		multi.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			done();
		});
		multi.exec();
	});

	it('supports multi with callback', function (done) {
		var multi = cache.multi();
		var called;
		multi.echo('OK', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('OK');
			called = true;
		});
		multi.exec(function (err) {
			should(err).not.be.ok;
			should(called).be.true;
			done();
		});
	});

	it('supports multi with chaining', function (done) {
		var multi = cache.multi();
		var responses = [];
		cache.multi().echo('OK').exec(done);
	});

});
