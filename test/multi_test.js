var should = require('should'),
	Cache = require('../'),
	cache;

describe('multi', function () {
	this.timeout(10000);

	before(function (done) {
		cache = new Cache({
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://local.cloud.appctest.com:8445'
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

	it('supports multi with multi replies', function (done) {
		var multi = cache.multi();
		cache.multi().echo('1').echo('2').echo('3').exec(function (err, replies) {
			should(err).be.not.ok;
			should(replies).be.an.array;
			should(replies).have.length(3);
			should(replies[0]).be.equal('1');
			should(replies[1]).be.equal('2');
			should(replies[2]).be.equal('3');
			done();
		});
	});

	it('supports multi with multi replies with cb', function (done) {
		var multi = cache.multi(),
			counter = 0,
			cb = function () {
				counter++;
			};
		cache.multi().echo('1', cb).echo('2', cb).echo('3', cb).exec(function (err, replies) {
			should(err).be.not.ok;
			should(replies).be.an.array;
			should(replies).have.length(3);
			should(replies[0]).be.equal('1');
			should(replies[1]).be.equal('2');
			should(replies[2]).be.equal('3');
			should(counter).be.equal(3);
			done();
		});
	});

});
