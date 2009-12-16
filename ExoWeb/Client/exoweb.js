﻿Function.prototype.mixin = function(methods, object) {
	if(!object)
		object = this.prototype;

	for (var m in methods) {
		object[m] = methods[m];
	}
}


// original function grabbed from http://oranlooney.com/functional-javascript/
Object.copy = function Object$Copy(obj) {
	if (typeof obj !== 'object') {
		return obj;  // non-object have value sematics, so obj is already a copy.
	} else {
		if (obj instanceof Array) {
			var result = [];
			for (var i = 0; i < obj.length; i++)
				result.push(Object.copy(obj[i]));
			return result;
		}
		else {
			var value = obj.valueOf();
			if (obj != value) {
				// the object is a standard object wrapper for a native type, say String.
				// we can make a copy by instantiating a new object around the value.
				return new obj.constructor(value);
			} else {
				// ok, we have a normal object. copy the whole thing, property-by-property.
				var c = {};
				for (var property in obj) c[property] = obj[property];
				return c;
			}
		}
	}
}


Type.registerNamespace("ExoWeb");

ExoWeb.trace = {
	// The following flags can be turned on to see debugging info.
	// Rather than editing the code below, set them in your application's page
	flags: {
	//		signal: true,
	//		typeInit: true,
	//		objectInit: true,
	//		propInit: true
	//		listInit: true,
	//		lazyLoad: true,
	//		markupExt: true,
	//		"~": true,
	//		"@": true,
	//		context: true,
	//		tests: true,
	//		mocks: true,
	//		server: true,
	//		ui: true,
	//		rule: true
	},
	log: function log(category, message, args) {
		if (typeof(console) === "undefined")
			return;

		var catStr;

		if (!(category instanceof Array))
			category = [category];

		var enable = false;
		for (var i = 0; i < category.length; ++i) {
			if (ExoWeb.trace.flags[category[i]]) {
				enable = true;
				break;
			}
		}

		if (!enable)
			return;

		catStr = category.join(", ");
		
		console.log("[" + category + "]: " + $format(message, args));
	}
};

(function() {
	var undefined;

	var log = ExoWeb.trace.log;

	function Signal(debugLabel) {
		this._waitForAll = [];
		this._pending = 0;
		var _this = this;
		this._oneDoneFn = function() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };

		this._debugLabel = debugLabel;
	}

	Signal.mixin({
		pending: function(callback) {
			this._pending++;
			log("signal", "(++{_pending}) {_debugLabel}", this);

			if (callback) {
				var _oneDoneFn = this._oneDoneFn;
				return function() {
					callback.apply(this, arguments);
					_oneDoneFn.apply(this, arguments);
				}
			}
			else
				return this._oneDoneFn;
		},
		waitForAll: function(callback) {
			if (!callback)
				return;

			if (this._pending == 0) {
				callback();
			} else
				this._waitForAll.push(callback);
		},
		oneDone: function() {
			log("signal", "(--{0}) {1}", [this._pending - 1, this._debugLabel]);

			--this._pending;

			while (this._pending == 0 && this._waitForAll.length > 0)
				Array.dequeue(this._waitForAll).apply(this, arguments);
		}
	});

	ExoWeb.Signal = Signal;


	//////////////////////////////////////////////////////////////////////////////////////
	Function.prototype.dontDoubleUp = function(options) {
		var proceed = this;
		var calls = [];

		return function dontDoubleUp() {
			// is the function already being called with the same arguments?

			var origCallback;

			if (options.callbackArg < arguments.length)
				origCallback = arguments[options.callbackArg];

			// determine what values to use to group callers
			var groupBy;

			if (options.groupBy) {
				groupBy = options.groupBy.apply(this, arguments)
			}
			else {
				groupBy = [this];
				for (var i = 0; i < arguments.length; ++i) {
					if (i != options.callbackArg)
						groupBy.push(arguments[i]);
				}
			}

			// is this call already in progress?
			var callInProgress;

			for (var c = 0; !callInProgress && c < calls.length; ++c) {
				var call = calls[c];

				// TODO: handle optional params better
				if (groupBy.length != call.groupBy.length)
					continue;

				callInProgress = call;
				for (var i = 0; i < groupBy.length; ++i) {
					if (groupBy[i] !== call.groupBy[i]) {
						callInProgress = null;
						break;
					}
				}
			}

			if (!callInProgress) {
				// track the next call that is about to be made
				var call = { callback: Functor(), groupBy: groupBy };
				calls.push(call);

				// make sure the original callback is invoked and that cleanup occurs
				call.callback.add(function() {
					Array.remove(calls, call);
					if (origCallback)
						origCallback.apply(this, arguments);
				});

				// pass the new callback to the inner function
				arguments[options.callbackArg] = call.callback;
				proceed.apply(this, arguments);
			}
			else if (origCallback) {
				// wait for the original call to complete
				callInProgress.callback.add(origCallback);
			}
		}
	}

	Function.prototype.cached = function(options) {
		var proceed = this;
		var cache = {};

		return function cached() {
			var key = options.key.apply(this, arguments);

			var result = cache[key];

			if (result === undefined) {
				result = proceed.apply(this, arguments);
				cache[key] = result;
			}

			return result;
		}
	}

	Function.prototype.setScope = function setScope(obj) {
		var func = this;
		return function setScope$function() {
			return func.apply(obj, arguments);
		}
	}

	Function.prototype.prependArguments = function prependArguments(/* arg1, arg2, ... */) {
		var func = this;
		var additional = Array.prototype.slice.call(arguments);
		return function prependArguments$function() {
			Array.addRange(additional, Array.prototype.slice.call(arguments));
			return func.apply(this, additional);
		}
	}

	Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
		var func = this;
		var additional = Array.prototype.slice.call(arguments);
		return function appendArguments$function() {
			var args = Array.prototype.slice.call(arguments);
			Array.addRange(args, additional);
			return func.apply(this, args);
		}
	}

	Function.prototype.spliceArguments = function spliceArguments(/* start, howmany, item1, item2, ... */) {
		var func = this;
		var spliceArguments = arguments;
		return function spliceArguments$function() {
			var args = Array.prototype.slice.call(arguments);
			args.splice.apply(args, spliceArguments);
			return func.apply(this, args);
		}
	}

	Function.prototype.sliceArguments = function sliceArguments(/* start, end */) {
		var func = this;
		var sliceArguments = arguments;
		return function spliceArguments$function() {
			var args = Array.prototype.slice.call(arguments);
			args = args.slice.apply(args, sliceArguments);
			return func.apply(this, args);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	function Functor() {
		var funcs = [];

		var f = function() {
			for (var i = 0; i < funcs.length; ++i)
				funcs[i].apply(this, arguments);
		};

		f._funcs = funcs;
		f.add = Functor.add;
		f.remove = Functor.remove;

		return f;
	}

	Functor.add = function() {
		for (var i = 0; i < arguments.length; ++i) {
			var f = arguments[i];

			if (f == null)
				continue;

			this._funcs.push(f);
		}
	}

	Functor.remove = function(old) {
		for (var i = this._funcs.length - 1; i >= 0; --i) {
			if (this._funcs[i] === old) {
				this._funcs.splice(i, 1);
				break;
			}
		}
	}

	Functor.eventing = {
		_addEvent: function(name, func) {
			if (!this["_" + name])
				this["_" + name] = new Functor();

			this["_" + name].add(func);
		},
		_removeEvent: function(name, func) {
			var handler = this["_" + name];
			if (handler)
				handler.remove(func);
		},
		_raiseEvent: function(name, argsArray) {
			var handler = this["_" + name];
			if (handler)
				handler.apply(this, argsArray);
		}
	};

	ExoWeb.Functor = Functor;
	///////////////////////////////////////////////////////////////////////////////
	function Transform(array, root) {
		if (!root) {
			Function.mixin(Transform.prototype, array);
			return array;
		}
		else {
			this.array = array;
		}
	}

	var compileFilterFunction = (function compileFilterFunction(filter) {
		return new Function("$item", "$index", "with($item){ return (" + filter + ");}");
	}).cached({ key: function(filter) { return filter; } });

	var compileGroupsFunction = (function compileGroupsFunction(groups) {
		return new Function("$item", "$index", "return $item['" + groups.split(",").join("']['") + "'];");
	}).cached({ key: function(groups) { return groups; } });

	var compileOrderingFunction = (function compileOrderingFunction(ordering) {
		var orderings = [];
		var parser = / *([a-z0-9_.]+)( +null)?( +(asc|desc))?( +null)? *(,|$)/gi;

		ordering.replace(parser, function(match, path, nullsFirst, ws, dir, nullsLast) {
			orderings.push({
				path: path,
				ab: dir === "desc" ? 1 : -1,
				nulls: nullsLast.length > 0 ? 1 : -1
			});
		});

		return function compare(aObj, bObj) {
			for (var i = 0; i < orderings.length; ++i) {
				var order = orderings[i];

				var a = evalPath(aObj, order.path, null, null);
				var b = evalPath(bObj, order.path, null, null);

				if (a === null && b !== null)
					return order.nulls;
				if (a !== null && b === null)
					return -order.nulls;
				if (a < b)
					return order.ab;
				if (a > b)
					return -order.ab;
			}

			return 0;
		}
	}).cached({ key: function(ordering) { return ordering; } });


	Transform.mixin({
		input: function() {
			return this.array || this;
		},
		where: function where(filter, thisPtr) {
			if (!(filter instanceof Function))
				filter = compileFilterFunction(filter);

			var output = [];

			var input = this.input();

			var len = input.length;
			for (var i = 0; i < len; ++i) {
				var item = input[i];

				if (filter.apply(thisPtr || item, [item, i]))
					output.push(item);
			}

			return new Transform(output);
		},
		groupBy: function groupBy(groups, thisPtr) {
			if (!(groups instanceof Function))
				groups = compileGroupsFunction(groups);

			var output = [];

			var input = this.input();
			var len = input.length;
			for (var i = 0; i < len; i++) {
				var item = input[i];
				var groupKey = groups.apply(thisPtr || item, [item, i]);

				var group = null;
				for (var g = 0; g < output.length; ++g) {
					if (output[g].group == groupKey) {
						group = output[g];
						group.items.push(item);
						break;
					}
				}

				if (!group)
					output.push({ group: groupKey, items: [item] });
			}
			return new Transform(output);
		},
		orderBy: function orderBy(ordering, thisPtr) {
			if (!(ordering instanceof Function))
				ordering = compileOrderingFunction(ordering);

			var input = this.input();
			var output = new Array(input.length);

			// make new array
			var len = input.length;
			for (var i = 0; i < len; i++)
				output[i] = input[i];

			// sort array in place
			if (!thisPtr)
				output.sort(ordering);
			else
				output.sort(function() { return ordering.apply(this, arguments); });

			return new Transform(output);
		}
	});

	ExoWeb.Transform = Transform;
	window.$transform = function $transform(array) { return new Transform(array, true); };

	function evalPath(obj, path, nullValue, undefinedValue) {
		var steps = path.split(".");

		if (obj === null)
			return arguments.length >= 3 ? nullValue : null;
		if (obj === undefined)
			return arguments.length >= 4 ? undefinedValue : undefined;

		for (var i = 0; i < steps.length; ++i) {
			var name = steps[i];
			var obj = obj[name];

			if (obj === null)
				return arguments.length >= 3 ? nullValue : null;
			if (obj === undefined)
				return arguments.length >= 4 ? undefinedValue : undefined;
		}

		if (obj === null)
			return arguments.length >= 3 ? nullValue : null;
		if (obj === undefined)
			return arguments.length >= 4 ? undefinedValue : undefined;

		return obj;
	}

	///////////////////////////////////////////////////////////////////////////
	function Translator() {
		this._forwardDictionary = {};
		this._reverseDictionary = {};
	}
	Translator.prototype = {
		lookup: function Translator$lookup(source, category, key) {
			if (!key) {
				key = category;
				category = null;
			}
			
			if (category)
				source = source[category] = (source[category] || {});
			
			return source[key] || null;
		},
		forward: function Translator$forward(category, key) {
			return this.lookup(this._forwardDictionary, category, key);
		},
		reverse: function Translator$reverse(category, key) {
			return this.lookup(this._reverseDictionary, category, key);
		},
		add: function Translator$addMapping(category, key, value) {
			if (!value) {
				value = key;
				key = category;
				category = null;
			}
			
			var forward = this._forwardDictionary;
			if (category)
				forward = forward[category] = (forward[category] || {});
				
			forward[key] = value;
			
			var reverse = this._reverseDictionary;
			if (category)
				reverse = reverse[category] = (reverse[category] || {});
				
			reverse[value] = key;
		}
	}
	ExoWeb.Translator = Translator;

	function getLastTarget(target, propertyPath) {
		var path = propertyPath;
		var finalTarget = target;

		if (path.constructor == String)
			path = path.split(".");
		else if (!(path instanceof Array))
			throw ("invalid parameter propertyPath");

		for (var i = 0; i < path.length - 1; i++) {
			if (finalTarget)
				finalTarget = getValue(finalTarget, path[i]);
		}
		
		return finalTarget;
	}
	
	ExoWeb.getLastTarget = getLastTarget;
	window.$lastTarget = getLastTarget;

	// If a getter method matching the given property name is found on the target it is invoked and returns the 
	// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
	// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
	// TODO: better name
	function getValue(target, property) {
		var getter = target["get_" + property];
		if (getter) {
			var value = getter.call(target);
			return value === undefined ? null : value;
		}
		else {
			return target[property];
		}
	}

	ExoWeb.getValue = getValue;

	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $format(str, values) {
		if (!values)
			return str;

		return str.replace(/{([a-z0-9_]+)}/ig, function(match, expr) {
			return evalPath(values, expr, "", match).toString();
		});
	}
	window.$format = $format;
})();


///////////////////////////////////////////////////////////////////////////////
// Simulate homogenous browsers
if (!Array.prototype.map) {
	Array.prototype.map = function(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function")
			throw new TypeError();

		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this)
				res[i] = fun.call(thisp, this[i], i, this);
		}

		return res;
	};
}

if (!Array.prototype.forEach)
{
	Array.prototype.forEach = function Array$forEach(fun /*, thisp*/)
	{
		var len = this.length >>> 0;
		if (typeof fun != "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this)
				fun.call(thisp, this[i], i, this);
		}
	};
}

if (!Array.prototype.every) {
	Array.prototype.every = function Array$every(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function")
			throw new TypeError();

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this &&
		  !fun.call(thisp, this[i], i, this))
				return false;
		}

		return true;
	};
}
 
if (!Array.prototype.indexOf)
{
	Array.prototype.indexOf = function(elt /*, from*/)
	{
		var len = this.length >>> 0;

		var from = Number(arguments[1]) || 0;
		from = (from < 0)
			? Math.ceil(from)
			: Math.floor(from);
		if (from < 0)
			from += len;

		for (; from < len; from++)
		{
			if (from in this && this[from] === elt)
				return from;
		}
		return -1;
	};
}


(function() {
	//////////////////////////////////////////////////////////////////////////////////////
	// MS Ajax extensions

	if (Sys.Binding) {

		// Get's a DOM element's bindings
		Sys.Binding.getElementBindings = function(el) {
			return el.__msajaxbindings || [];
		};

		// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
		Sys.Binding.mixin({
			get_finalSourceObject: function() {
				var src = this.get_source();

				for (var i = 0; i < this._pathArray.length - 1; ++i)
					src = src[this._pathArray[i]];

				return src;
			},
			get_finalPath: function() {
				return this._pathArray[this._pathArray.length - 1];
			}
		});

	}

	function _raiseSpecificPropertyChanged(target, args) {
		var func = target.__propertyChangeHandlers[args.get_propertyName()];
		func(target);
	}

	// Converts observer events from being for ALL properties to a specific one.
	// This is an optimization that prevents handlers interested only in a single
	// property from being run when other, unrelated properties change.
	Sys.Observer.addSpecificPropertyChanged = function(target, property, handler) {
		if (!target.__propertyChangeHandlers) {
			target.__propertyChangeHandlers = {};

			Sys.Observer.addPropertyChanged(target, _raiseSpecificPropertyChanged);
		}

		var func = target.__propertyChangeHandlers[property];

		if (!func)
			target.__propertyChangeHandlers[property] = func = ExoWeb.Functor();

		func.add(handler);
	};


	// Supress raising of property changed when a generated setter is already raising the event
	Sys.Observer._setValue = function Sys$Observer$_setValue(target, propertyName, value) {
		var getter, setter, mainTarget = target, path = propertyName.split('.');
		for (var i = 0, l = (path.length - 1); i < l; i++) {
			var name = path[i];
			getter = target["get_" + name];
			if (typeof (getter) === "function") {
				target = getter.call(target);
			}
			else {
				target = target[name];
			}
			var type = typeof (target);
			if ((target === null) || (type === "undefined")) {
				throw Error.invalidOperation(String.format(Sys.Res.nullReferenceInPath, propertyName));
			}
		}

		var notify = true; // added
		var currentValue, lastPath = path[l];
		getter = target["get_" + lastPath];
		setter = target["set_" + lastPath];
		if (typeof (getter) === 'function') {
			currentValue = getter.call(target);
		}
		else {
			currentValue = target[lastPath];
		}
		if (typeof (setter) === 'function') {
			notify = !setter.__notifies; // added
			setter.call(target, value);
		}
		else {
			target[lastPath] = value;
		}
		if (currentValue !== value) {
			var ctx = Sys.Observer._getContext(mainTarget);
			if (ctx && ctx.updating) {
				ctx.dirty = true;
				return;
			};
			if (notify) // added
				Sys.Observer.raisePropertyChanged(mainTarget, path[0]);
		}
	}
})();