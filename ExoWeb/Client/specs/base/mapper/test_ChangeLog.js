﻿// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

global.window = global;
global.ExoWeb = {};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
var trace = require("../../../src/base/core/Trace");
var utilities = require("../../../src/base/core/Utilities");

global.forEach = arrays.forEach;

// References
///////////////////////////////////////
ChangeLog = require("../../../src/base/mapper/ChangeLog").ChangeLog;
ChangeSet = require("../../../src/base/mapper/ChangeSet").ChangeSet;

var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

function setup() {
	var log = new ChangeLog();
	log.start("test");
	log.add(1);
	log.add(2);
	log.start("test2");
	log.add(3);

	this.log = log;
}

// Test Suites
///////////////////////////////////////
describe("ChangeLog", function() {
	it("initially has no sets", function() {
		expect((new ChangeLog()).sets().length).toBe(0);
	});

	it("throws an error if a change is added before starting", function() {
		expect(function() {
			(new ChangeLog()).add(5);
		}).toThrow("The change log is not currently active.");
	});

	it("requires a string source when calling start", function() {
		expect(function() {
			(new ChangeLog()).start();
		}).toThrow("ChangeLog.start requires a string source argument.");

		expect(function() {
			(new ChangeLog()).start(5);
		}).toThrow("ChangeLog.start requires a string source argument.");
	});

	it("allows a change to be added after calling start", function() {
		var log = new ChangeLog();
		log.start("test");
		log.add(5);
		
		expect(log.sets().length).toBe(1);
		expect(log.sets()[0].changes().length).toBe(1);
		expect(log.sets()[0].changes()[0]).toBe(5);
	});
});

describe("ChangeLog", function() {
	beforeEach(setup);

	it("pushes new changes onto the new set after calling start a second time", function() {
		expect(this.log.sets().length).toBe(2);
		expect(this.log.sets()[0].changes().length).toBe(2);
		expect(this.log.sets()[1].changes().length).toBe(1);
		expect(this.log.sets()[1].changes()[0]).toBe(3);
		expect(this.log.activeSet().source()).toBe("test2");
	});

	it("serializes only changes that pass a given filter", function() {
		expect(this.log.serialize(function(c) {
			return c > 1;
		})).toEqual([
			{
				source: "server",
				changes: [2]
			},
			{
				source: "server",
				changes: [3]
			}
		]);
	});
	
	it("returns the last change added", function() {
		expect(this.log.lastChange()).toBe(3);
	});
	
	it("returns null if undo is called and there are no changes", function() {
		var log = new ChangeLog();
		log.start("test");
		expect(log.undo()).toEqual(null);
	});

	it("cannot undo if the log is not active", function() {
		expect(function() {
			(new ChangeLog()).undo();
		}).toThrow("The change log is not currently active.");
	});

	it("undo removes and returns the last change", function() {
		var lastChange = this.log.lastChange();
		var change = this.log.undo();
		expect(this.log.sets().length).toBe(2);
		expect(this.log.activeSet().source()).toBe("test2");
		expect(this.log.activeSet().changes().length).toBe(0);
		expect(change).toBe(lastChange);
	});

	it("undo steps over empty sets", function() {
		// create an empty set
		this.log.start("test3");

		var change = this.log.undo();
		expect(this.log.sets().length).toBe(2);
		expect(this.log.activeSet().source()).toBe("test2");
		expect(this.log.activeSet().changes().length).toBe(0);
		expect(change).toBe(3);
	});

	it("discards all sets and changes when truncated, creating a new \"client\" set", function() {
		this.log.truncate();

		expect(this.log.sets().length).toBe(1);
		expect(this.log.sets()[0].source()).toBe("client");
		expect(this.log.sets()[0].changes().length).toBe(0);
	});

	it("discards all sets and changes that meet the given filter when truncated", function() {
		this.log.truncate(function(c) {
			return c > 1;
		});

		expect(this.log.sets().length).toBe(2);
		expect(this.log.sets()[0].source()).toBe("test");
		expect(this.log.sets()[0].changes().length).toBe(1);
		expect(this.log.sets()[0].changes()[0]).toBe(1);
		expect(this.log.sets()[1].source()).toBe("client");
		expect(this.log.activeSet().source()).toBe("client");
		expect(this.log.activeSet().changes().length).toBe(0);
	});
});

describe("ChangeLog.addSet", function() {
	it("allows a set to be added to an active change log", function() {
		var log = new ChangeLog();
		log.start("test");
		expect(log.activeSet().source()).toBe("test");

		var active = log.activeSet();

		log.addSet("test2", [1, 2]);
		expect(log.sets().length).toBe(2);
		expect(log.activeSet()).toBe(active);
	});

	it("adds a non-active set to the change log", function() {
		var changes = [1, 2, 3];
		var log = new ChangeLog();
		log.addSet("test", changes);

		var active = log.activeSet();

		expect(log.sets().length).toBe(1);
		expect(log.sets()[0].changes().length).toBe(3);
		expect(log.sets()[0].changes()).not.toBe(changes);
		expect(log.activeSet()).toBe(active);
	});
});

describe("ChangeLog.count", function() {
	beforeEach(setup);

	it("returns the number of changes in the log", function () {
		expect(this.log.count()).toBe(3);
	});

	it("returns the number of changes that match a given filter", function () {
		expect(this.log.count(function(v) { return v > 2; })).toBe(1);
	});
	
	it("uses thisPtr if provided", function () {
		this.log.val = 1;
		expect(this.log.count(function(v) { return v > this.log.val; }, this)).toBe(2);
	});
});

describe("ChangeLog.set", function() {
	beforeEach(setup);

	it("retrieves the change set at the given index", function() {
		expect(this.log.set(0).source()).toBe("test");
		expect(this.log.set(1).source()).toBe("test2");
	});

	it("raises an error if a valid index is not given", function() {
		var log = this.log;

		expect(function() {
			log.set();
		}).toThrow("The set method expects a numeric index argument.");

		expect(function() {
			log.set("bad");
		}).toThrow("The set method expects a numeric index argument.");
	});

	it("supports negative indices", function() {
		expect(this.log.set(-1).source()).toBe("test2");
		expect(this.log.set(-2).source()).toBe("test");
	});

	it("does not support wrapping", function() {
		expect(this.log.set(-3)).toBe(undefined);
		expect(this.log.set(4)).toBe(undefined);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
