'use strict';

/**
 * commands we do not specifically allow
 */
module.exports = [
	"bgrewriteaof",
	"bgsave",
	"client kill",
	"client list",
	"client getname",
	"client pause",
	"client setname",
	"config get",
	"config rewrite",
	"config set",
	"config resetstat",
	"dbsize",
	"auth",
	"debug object",
	"debug segfault",
	"dump",
	"restore",
	"info",
	"migrate",
	"monitor",
	"move",
	"pubsub",
	"script exists",
	"script flush",
	"script kill",
	"script load",
	"select",
	"shutdown",
	"slaveof",
	"slowlog",
	"sync",
	"unwatch",
	"watch"
];
