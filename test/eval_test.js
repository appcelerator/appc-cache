var should = require('should'),
	Cache = require('../'),
	cache;

describe('eval', function () {
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

	it('supports basic eval', function (done) {
		cache.eval('return KEYS[1]', 1, 'foo', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('foo');
			done();
		});
	});

	it('supports basic redis.call with key as arg', function (done) {
		cache.set('foo', 'bar');
		cache.eval('return redis.call("get", KEYS[1])', 1, 'foo', function (err, reply) {
			should(err).not.be.ok;
			should(reply).be.equal('bar');
			done();
		});
	});

	it('supports basic redis.call with key as string', function (done) {
		cache.set('foo', 'bar');
		cache.eval('return redis.call("get", "foo")', 0, function (err, reply) {
			should(err).be.undefined;
			should(reply).be.equal('bar');
			done();
		});
	});

	it('supports basic redis.call with if statement', function (done) {
		cache.set('foo', 'bar');
		cache.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return 1 else return 0 end', 1, 'foo', 'bar', function (err, reply) {
			should(err).be.not.ok;
			should(reply).be.equal(1);
			done();
		});
	});

});
