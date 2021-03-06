/// <reference path="../core/Errors.js" />

var pendingTypeExtensions = {};
var pendingSubtypeExtensions = {};

function raiseExtensions(mtype) {
	//ExoWeb.Batch.whenDone(function() { 
		// apply app-specific configuration
		// defer until loading is completed to reduce init events
		var exts = pendingTypeExtensions[mtype.get_fullName()];
		if (exts) {
			delete pendingTypeExtensions[mtype.get_fullName()];
			exts(mtype.get_jstype());
		}

		mtype.eachBaseType(function(baseType) {
			var subExts = pendingSubtypeExtensions[baseType.get_fullName()];
			if (subExts) {
				// don't delete subtype extensions since more subtypes may be created
				subExts(mtype.get_jstype());
			}
		});
	//});
}

function extendOne(typeName, callback, thisPtr) {
	var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

	if (jstype && LazyLoader.isLoaded(jstype.meta)) {
		callback.call(thisPtr || this, jstype);
	}
	else {
		var pending = pendingTypeExtensions[typeName];

		if (!pending) {
			pending = pendingTypeExtensions[typeName] = ExoWeb.Functor();
		}

		pending.add(thisPtr ? callback.bind(thisPtr) : callback);
	}
}

window.$extend = function(typeInfo, callback, thisPtr) {
	if (typeInfo == null) throw new ArgumentNullError("typeInfo");

	// If typeInfo is an arry of type names, then use a signal to wait until all types are loaded.
	if (Object.prototype.toString.call(typeInfo) === "[object Array]") {
		var signal = new ExoWeb.Signal("extend");

		var types = [];
		typeInfo.forEach(function(item, index) {
			if (item.constructor !== String) {
				throw new ArgumentTypeError("typeInfo", "string", item);
			}

			extendOne(item, signal.pending(function(type) {
				types[index] = type;
			}), thisPtr);
		});

		signal.waitForAll(function() {
			// When all types are available, call the original callback.
			callback.apply(thisPtr || this, types);
		});
	}
	// Avoid the overhead of signal and just call extendOne directly.
	else if (typeInfo.constructor === String) {
		extendOne(typeInfo, callback, thisPtr);
	}
	else {
		throw new ArgumentTypeError("typeInfo", "string|array", typeInfo);
	}
};

window.$extendSubtypes = function(typeName, callback, thisPtr) {
	if (typeName == null) throw new ArgumentNullError("typeName");
	if (typeName.constructor !== String) throw new ArgumentTypeError("typeName", "string", typeName);

	var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

	if (jstype) {
		// Call for existing, loaded subtypes
		Array.forEach(jstype.meta.derivedTypes || [], function(mtype) {
			if (mtype && LazyLoader.isLoaded(mtype)) {
				callback.call(thisPtr || this, mtype.get_jstype());
				Array.forEach(mtype.derivedTypes || [], arguments.callee.spliceArguments(1, 2));
			}
		});
	}
	
	var pending = pendingSubtypeExtensions[typeName];

	if (!pending) {
		pending = pendingSubtypeExtensions[typeName] = ExoWeb.Functor();
	}

	pending.add(thisPtr ? callback.bind(thisPtr) : callback);
};

window.$extendProperties = function (typeName, includeBuiltIn, callback, thisPtr) {
	if (typeName == null) throw new ArgumentNullError("typeName");
	if (typeName.constructor !== String) throw new ArgumentTypeError("typeName", "string", typeName);

	if (includeBuiltIn && includeBuiltIn instanceof Function) {
		thisPtr = callback;
		callback = includeBuiltIn;
		includeBuiltIn = false;
	}

	extendOne(typeName, function (jstype) {
		// Raise handler for existing properties
		jstype.meta.get_properties().forEach(function (prop) {
			if (includeBuiltIn === true || prop.get_origin() !== "server")
				callback.call(thisPtr || this, prop, true);
		});

		// Raise handler when new properties are added
		jstype.meta.addPropertyAdded(function (sender, args) {
			callback.call(thisPtr || this, args.property, false);
		});
	});
}
