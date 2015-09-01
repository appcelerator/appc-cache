var url = require('url'),
	crypto = require('crypto'),
	util = require('util'),
	request = require('request'),
	colors = require('colors'),
	debug = require('debug')('appc:cache'),
	EventEmitter = require('events').EventEmitter,
	environments = {
		'production': 'https://cache.appcelerator.com',
		'preproduction': 'https://cache-preprod.cloud.appctest.com'
	},
	version = require('../package.json').version,
	processExit = process.exit,
	events = ['exit', 'shutdown', 'SIGINT', 'SIGTERM'],
	fingerprint;

/**
 * utility to determine if we're running in production
 */
function isRunningInPreproduction() {
	return process.env.NODE_ACS_URL &&
		process.env.NODE_ACS_URL.indexOf('.appctest.com') > 0 ||
		process.env.NODE_ENV === 'preproduction' ||
		process.env.APPC_ENV === 'preproduction' ||
		process.env.NODE_ENV === 'development' ||
		process.env.APPC_ENV === 'development';
}

function sha1(value) {
	var crypto = require('crypto');
	var sha = crypto.createHash('sha1');
	sha.update(value);
	return sha.digest('hex');
}

/**
 * get a unique fingerprint for the machine (hashed) which is used for
 * server-side client id tracking
 */
function getComputerFingerprint (callback, append) {
	if (fingerprint) { return callback && callback(null, fingerprint); }
	var exec = require('child_process').exec,
		cmd;
	switch (process.platform) {
		case 'darwin':
			// serial number + uuid is a good fingerprint
			// jscs:disable validateQuoteMarks
			cmd = "ioreg -l | awk '/IOPlatformSerialNumber/ { print $4 }' | sed s/\\\"//g && ioreg -rd1 -c IOPlatformExpertDevice |  awk '/IOPlatformUUID/ { print $3; }' | sed s/\\\"//g;";
			debug('running:', cmd);
			return exec(cmd, function (err, stdout) {
				if (err) { return callback(err); }
				var tokens = stdout.trim().split(/\s/),
					serial = tokens[0],
					uuid = tokens[1];
				fingerprint = sha1(stdout + process.pid);
				callback && callback(null, fingerprint);
			});
		case 'win32':
		case 'windows':
			cmd = 'reg query HKLM\\Software\\Microsoft\\Cryptography /v MachineGuid';
			if (append) { cmd += append; }
			debug('running:', cmd);
			return exec(cmd, function (err, stdout) {
				if (err && !append) {
					debug('trying again, forcing it to use 64bit registry view');
					return getComputerFingerprint(callback, ' /reg:64');
				} else if (err) {
					return callback(err);
				}
				var tokens = stdout.trim().split(/\s/),
					serial = tokens[tokens.length - 1];
				fingerprint = sha1(serial + process.pid);
				callback && callback(null, fingerprint);
			});
		case 'linux':
			cmd = "ifconfig | grep eth0 | grep -i hwaddr | awk '{print $1$5}' | sed 's/://g' | xargs echo | sed 's/ //g'";
			debug('running:', cmd);
			return exec(cmd, function (err, stdout) {
				if (err) { return callback(err); }
				var serial = stdout.trim();
				fingerprint = sha1(serial + process.pid);
				callback && callback(null, fingerprint);
			});
		default:
			callback(new Error("Unknown platform:" + process.platform));
	}
}

/**
 * get our interface information for both public and private
 */
function getIPAddresses (callback) {
	getComputerFingerprint(function (err, fingerprint) {
		try {
			var internalIP = require('internal-ip')();
			var handler = function errorHandler(e) {
				// this happens if we are offline, just capture it for now
			};
			process.on('uncaughtException', handler);
			var pip = require('public-ip');
			pip(function (err, publicIP) {
				process.removeListener('uncaughtException', handler);
				callback(null, {
					publicAddress: publicIP || internalIP,
					privateAddress: internalIP || '127.0.0.1'
				}, fingerprint || Date.now());
			});
		}
		catch (E) {
			callback(E);
		}
	});
}

/**
 * Class constructor
 *
 * @class Cache
 * @param {Object} opts options for configuring the client
 */
function Cache(opts) {
	opts = opts || {};
	opts.debug && (debug = function () {
		var args = Array.prototype.slice.call(arguments);
		if (args[0] && !!~args[0].indexOf('%')) {
			var result = util.format.apply(util.format, args);
			console.log('appc:cache'.red, result);
		} else {
			args.unshift('appc:cache'.red);
			console.log.apply(this, args);
		}
	});
	var env = opts.env || isRunningInPreproduction() ? 'preproduction' : 'production';
	this.timeout = opts.timeout || 10000;
	this.url = opts.url || environments[env] || environments.production;
	this.key = opts.key;
	this.secret = opts.secret;
	this.preferWebSocket = true;
	if (!this.key) {
		throw new Error('missing key');
	}
	if (!this.secret) {
		throw new Error('missing secret');
	}
	var self = this;
	this.disabled = opts.disabled;
	this.init();
	getComputerFingerprint();
	this._pendingStart = true;
	var localExit = function localExit(ec) {
		if (self._pendingStart) {
			debug('process.exit called but pending start, will exit on connect');
			self._pendingStartExit = true;
			self._pendingStartExitCode = ec;
			return;
		}
		debug('process exit called');
		processExit.apply(this, arguments);
	};
	process.exit = localExit;
	process.nextTick(function () {
		self._reconnect();
		self._pendingStart = false;
		if (process.exit === localExit) {
			debug('resetting process.exit');
			process.exit = processExit;
		}
		if (self._pendingStartExit) {
			debug('pending start, we exited');
			process.exit(self._pendingStartExitCode);
		}
	});
}

util.inherits(Cache, EventEmitter);

/**
 * return the fingerprint
 */
Cache.prototype.getFingerprint = function (callback) {
	if (fingerprint && callback) {
		return callback(null, fingerprint);
	} else if (fingerprint) {
		return fingerprint;
	} else if (callback) {
		return getComputerFingerprint(callback);
	}
	throw new Error('fingerprint has not yet been generated. invoke this function with a callback');
};

/**
 * common handler for errors
 */
function createErrorHandler (self, opts) {
	return function cacheRequetErrorHandler(err) {
		if (/^(ETIMEDOUT|ENOTFOUND|ECONNREFUSED)$/.test(err.code)) {
		}
		self.emit('error', err, opts);
		debug('error called', err, opts);
	};
}

Cache.prototype.close = function() {
	if (this.disabled) { return; }
	debug('close, closed=%d, closing=%d, connecting=%d, sending=%d, authed=%d', !!this._closed, !!this._closing, !!this._connecting, !!this._sending, !!this._authed);
	var self = this;
	if (!this._closed && !this._closing) {
	}
	if (!this._closing) {
		this._closing = Date.now();
		if (!this._closingTimer) {
			clearTimeout(this._closingTimer);
			this._closingTimer = setTimeout(function() {
				debug('closing timer has fired');
				self._sending = self._connecting = false;
				self.close();
				process.exit();
			}, 10000);
		}
	}
	if ((this._connecting || this._sending) && !this._shutdown) {
		debug('close is waiting to connect, delay, connecting=%d, sending=%d',this._connecting,this._sending);
		if (this._shutdownTimer) { return true; }
		setTimeout(function() {
			// attempt to close again immediately
			self.close();
		}, 500);
		this._shutdownTimer = setTimeout(function() {
			debug('shutdown #1 timer has fired');
			self._shutdown = self._sending = self._connecting = false;
			self._closed = true; // force close if we haven't received it yet
			self.close();
			process.exit();
		},5000);
		return true;
	}
	this._closed = true;
	if (this._socket && !this._shutdown) {
		this._shutdown = true;
		if (this._connected && !this._closed) {
			if (this._shutdownTimer) { return true; }
			debug('close sending disconnecting');
			this._socket.emit('disconnecting');
			this._shutdownTimer = setTimeout(function() {
				debug('shutdown #2 timer has fired');
				self._shutdown = self._sending = self._connecting = false;
				self._closed = true; // force close if we haven't received it yet
				self.close();
				process.exit();
			},5000);
			return true;
		}
	}
	this._connected = this._connecting = this._authed = false;
	this.removeAllListeners();
	if (this._socket) {
		this._socket.close();
		this._socket = null;
	}
	clearInterval(this._socketKA);
	this._socketKA = null;
	var shutdownHandler = this._shutdownHandler;
	if (this._shutdownHandler) {
		events.forEach(function (signal) {
			try { process.removeListener(signal, self._shutdownHandler); } catch (E) { }
		});
		this._shutdownHandler = null;
	}
	if (processExit && process.exit !== processExit) {
		process.exit = processExit;
	}
	if (this._shutdownTimer) {
		clearTimeout(this._shutdownTimer);
		this._shutdownTimer = null;
	}
	if (this._closingTimer) {
		clearTimeout(this._closingTimer);
		this._closingTimer = null;
	}
	debug('close pendingExit (%d)', this._pendingExit);
	this._shutdown = this._closed = true;
	this._closing = false;
	if (this._pendingExit) {
		debug('calling process.exit(%d)', this._pendingExitCode);
		processExit(this._pendingExitCode);
	}
	return this._closed;
};

function createDisconnectHandler(self, socket, reconnect) {
	return function disconnectHandler(reason, message) {
		debug('disconnect', reason, message, reconnect, !!self._pendingExit);
		if (self._closing && !self._closed) {
			debug('already closing, ignore disconnect');
			return;
		}
		var serverDisconnect = reason === 'io server disconnect';
		if (self._pendingStart && !serverDisconnect) {
			self._pendingStartExit = true;
			self._pendingStartExitCode = reason;
			self._pendingExit = true;
			debug('pending start, ignore disconnect');
			setTimeout(function() {
				self.emit('disconnecting');
				disconnectHandler(reason, message);
			}, self._sending ? 3000 : 1000);
			return;
		}
		var delay;
		if (!reconnect && !self._pendingExit && !serverDisconnect) {
			self._pendingExit = true;
			if (socket && !reason) {
				if (self._sending) { return ;}
				socket.emit('disconnecting');
				return setTimeout(function() {
					disconnectHandler(reason, message);
				}, self._sending ? 3000 : 1000);
			}
		}
		if (!reason && !reconnect || serverDisconnect) {
			delay = self.close();
		}
		if (reason && reason !== 'unauthorized' && !serverDisconnect) {
			if (!self._connecting && reconnect && !self._shutdown) {
				self._reconnect();
			}
		} else if (reason && !serverDisconnect) {
			var err = new Error(message);
			err.code = reason;
			self.emit('error',err);
		}
		if (self._shutdownHandler) {
			events.forEach(function (signal) {
				try { process.removeListener(signal, self._shutdownHandler); } catch (E) { }
			});
			self._shutdownHandler = null;
		}
		if (self._disconnectHandler) {
			socket.removeListener('disconnecting', self._disconnectHandler);
			socket.removeListener('disconnect', self._disconnectHandler);
			self._disconnectHandler = null;
		}
	};
}

Cache.prototype._reconnect = function() {
	if (this.disabled) { return; }
	debug('_reconnect');
	if (this._connecting || this._closed) {
		debug('_reconnect called but connecting=%d, closed=%d', !!this._connecting, !!this._closed);
		return;
	}
	this._authed = false;
	this._connecting = true;
	this._connected = false;
	clearInterval(this._socketKA);
	this._socketKA = setInterval(function () {
	}, 60000);
	if (this._socket) {
		debug('closing existing socket', this._socket);
		this._socket.close();
	}
	var socket = this._socket = require('socket.io-client')(this.url, {forceNew:true});
	var self = this;
	debug('connecting url=%s', this.url);
	socket.on('connect', function() {
		debug('connected');
		// we can get multiple notices so we ignore after first
		if (self._connected) { return; }
		self._connected = true;
		self._connecting = false;
		self._shutdown = false;
		// if closed before fully auth, just return
		getIPAddresses(function (err, address, fingerprint) {
			socket.emit('authenticate', {
				uuid: fingerprint, // used to uniquely identify this client
				key: self.key,
				signature: crypto.createHmac('SHA256',self.secret).update(self.key).digest('base64'),
				address: address
			});
			socket.on('authenticated', function () {
				if (self._authed || self._closed) { return; }
				self._authed = true;
				debug('authenticated');
				socket.emit('register');
			});
			socket.on('ping', function () {
				debug('received ping, sending pong');
				socket.emit('pong');
			});
		});
	});
	socket.io.on('connect_error', function(data) {
		self.emit('connect_error', data);
	});
	if (this._shutdownHandler) {
		events.forEach(function (signal) {
			try { process.removeListener(signal, self._shutdownHandler); } catch (E) { }
		});
	}
	this._disconnectHandler = createDisconnectHandler(this, socket, true);
	this._shutdownHandler = createDisconnectHandler(this, socket, false);
	socket.on('disconnecting', this._disconnectHandler);
	socket.on('disconnect', this._disconnectHandler);
	events.forEach(function (signal) {
		process.on(signal, self._shutdownHandler);
	});
};

Cache.prototype._connect = function(name) {
	if (this.disabled) { return; }
	debug('_connect %s', name);
	var i = name.indexOf(':'),
		pattern = name.substring(i+1);

	if (!this._connected) {
		this._reconnect();
	} else if (this._socket && this._authed) {
		this._socket.emit('register');
	}
};

////////////////////////////////////////////////////////////////////////////////

/**
 * ensure we're connected and authenticated before invoking
 */
function createWrappedFunction (self, name) {
	var fn = self[name],
		delegate;
	self[name] = delegate = function wrappedFunction() {
		var args = arguments;
		if (self._authed) {
			debug('exec => %s', name);
			return fn.apply(self, args);
		} else {
			setTimeout(function() {
				return delegate.apply(self, args);
			}, 10);
		}
	};
}

/**
 * generic callback handler
 */
function createResponseHandler (self, callback) {
	return function responseHandler (err, resp) {
		if (err) {
			return callback && callback(err);
		}
		if (resp && resp.error) {
			return callback && callback(new Error(resp.message));
		}
		callback && callback(null, resp && resp.data);
	};
}

Cache.prototype.init = function() {
	['get', 'set', 'ttl', 'expire'].forEach(function (name) {
		createWrappedFunction(this, name);
	}, this);
};

/**
 * get a key from the cache
 */
Cache.prototype.get = function(name, callback) {
	this._socket.emit('command', {action:'get', key:name}, createResponseHandler(this, callback));
};

/**
 * set a key in the cache
 */
Cache.prototype.set = function(name, value, ttl, callback) {
	if (typeof(ttl) === 'function' || arguments.length < 3) {
		callback = ttl;
		ttl = 0;
	}
	if (ttl === undefined || ttl === null) {
		ttl = 0; // none
	}
	this._socket.emit('command', {action:'set', key:name, value: value, ttl: ttl}, createResponseHandler(this, callback));
};

/**
 * expire a key in the cache
 */
Cache.prototype.expire = function(name, callback) {
	this._socket.emit('command', {action:'expire', key:name}, createResponseHandler(this, callback));
};

/**
 * set the ttl for a key in the cache
 */
Cache.prototype.ttl = function(name, ttl, callback) {
	this._socket.emit('command', {action:'ttl', key:name, ttl: ttl}, createResponseHandler(this, callback));
};

module.exports = Cache;
