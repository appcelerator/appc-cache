var should = require('should'),
	Cache = require('../'),
	cache;

describe('lock', function () {
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

	it('supports locking', function (done) {
		var lock = 'test.lock';
		cache.lock(lock, 1000, function (err, lock) {
			if (err) { return done(err); }
			should(lock).be.an.object;
			cache.unlock(lock, done);
		});
	});

	it('supports lock failure', function (done) {
		var lockkey = 'test.lock';
		cache.lock(lockkey, 10000, function (err, lock) {
			if (err) { return done(err); }
			should(lock).be.an.object;
			cache.lock(lockkey, 1000, function (err, lock2) {
				should(err).be.ok;
				should(err).be.an.Error;
				should(err.message).match(/Exceeded \d attempts to lock the resource/);
				cache.unlock(lock, done);
			});
		});
	});

	it('supports lock extend', function (done) {
		var lockkey = 'test.lock';
		cache.lock(lockkey, 1000, function (err, lock) {
			if (err) { return done(err); }
			should(lock).be.an.object;
			cache.extend(lock, 5000);
			setTimeout(function () {
				// should still fail since we've extended
				cache.lock(lockkey, 1000, function (err, lock2) {
					should(err).be.ok;
					should(err).be.an.Error;
					should(err.message).be.ok;
					should(err.message).match(/Exceeded \d attempts to lock the resource/);
					cache.unlock(lock, done);
				});
			}, 1000);
		});
	});

	it('supports lock expires', function (done) {
		var lockkey = 'test.lock';
		cache.lock(lockkey, 100, function (err, lock) {
			if (err) { return done(err); }
			should(lock).be.an.object;
			setTimeout(function () {
				// should not fail since it should have expired above
				cache.lock(lockkey, 1000, function (err, lock2) {
					should(err).not.be.ok;
					should(lock2).be.an.object;
					cache.unlock(lock2, done);
				});
			}, 1000);
		});
	});

});
