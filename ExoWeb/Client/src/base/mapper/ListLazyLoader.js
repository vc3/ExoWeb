function ListLazyLoader() {
}

function listLoad(list, propName, callback, thisPtr) {
	var signal = new ExoWeb.Signal("list lazy loader");

	var model = list._ownerProperty.get_containingType().get_model();
	var ownerId = list._ownerId;
	var ownerType = list._ownerProperty.get_containingType().get_fullName();
	var prop = list._ownerProperty;
	var propIndex = list._ownerProperty.get_index();
	var propName = list._ownerProperty.get_name();
	var propType = list._ownerProperty.get_jstype().meta;

	// load the objects in the list
//				ExoWeb.trace.log(["listInit", "lazyLoad"], "Lazy load: {0}({1}).{2}", [ownerType, ownerId, propName]);

	var objectJson, conditionsJson;

	listProvider(ownerType, list._ownerId, propName, ObjectLazyLoader.getRelativePathsForType(propType),
		signal.pending(function(result) {
			objectJson = result.instances;
			conditionsJson = result.conditions;
		}),
		signal.orPending(function(e) {
			var message = $format("Failed to load {0}({1}).{2}: ", [ownerType, ownerId, propName]);
			if (e !== undefined && e !== null &&
					e.get_message !== undefined && e.get_message !== null &&
					e.get_message instanceof Function) {

				message += e.get_message();
			}
			else {
				message += "unknown error";
			}
			ExoWeb.trace.logError("lazyLoad", message);
		})
	);

	// ensure that the property type is loaded as well.
	// if the list has objects that are subtypes, those will be loaded later
	// when the instances are being loaded
	if (!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
		ExoWeb.Model.LazyLoader.load(propType, null, signal.pending());
	}

	signal.waitForAll(function() {
		if (!objectJson) {
			return;
		}

//					ExoWeb.trace.log("list", "{0}({1}).{2}", [ownerType, ownerId, propName]);

		// The actual type name and id as found in the resulting json.
		var jsonId = ownerId;
		var jsonType = ownerType;

		// Find the given type and id in the object json.  The type key may be a dervied type.
		function searchJson(mtype, id) {
			// The given type is a key that is present in the result json.
			if (objectJson[mtype.get_fullName()]) {

				// The id is also a key.
				if (objectJson[mtype.get_fullName()][id]) {
					jsonType = mtype.get_fullName();
					jsonId = id;
					return true;
				}

				// Ids returned from the server are not always in the same case as ids on the client, so check one-by-one.
				for (var varId in objectJson[mtype.get_fullName()]) {
					if (varId.toLowerCase() == id.toLowerCase()) {
						jsonType = mtype.get_fullName();
						jsonId = varId;
						return true;
					}
				}
			}

			// Check derived types recursively.
			for (var i = 0; i < mtype.derivedTypes.length; i++) {
				if (searchJson(mtype.derivedTypes[i], id)) {
					return true;
				}
			}
		}

		if (!searchJson(ExoWeb.Model.Model.getJsType(ownerType).meta, ownerId)) {
			ExoWeb.trace.throwAndLog(["list", "lazyLoad"], "Data could not be found for {0}:{1}.", [ownerType, ownerId]);
		}

		var listJson = list._ownerProperty.get_isStatic() ?
			objectJson[jsonType][jsonId][propName] :
			objectJson[jsonType][jsonId][propIndex];

		// populate the list with objects
		for (var i = 0; i < listJson.length; i++) {
			var ref = listJson[i];
			var item = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));
			list.push(item);

			// if the list item is already loaded ensure its data is not in the response
			// so that it won't be reloaded
			if (ExoWeb.Model.LazyLoader.isLoaded(item)) {
				delete objectJson[item.meta.type.get_fullName()][ref.id];
			}
		}

		// get the list owner type (static) or entity (non-static)
		var owner = ownerId === STATIC_ID ?
			propType.get_jstype() :
			getObject(model, ownerType, ownerId, null);

		// remove list from json and process the json.  there may be
		// instance data returned for the objects in the list
		if (ExoWeb.Model.LazyLoader.isLoaded(owner)) {
			delete objectJson[jsonType][jsonId];
		}

		ListLazyLoader.unregister(list, this);

		var batch = ExoWeb.Batch.start($format("{0}({1}).{2}", [ownerType, ownerId, propName]));

		var done = function() {
			// Collection change driven by user action or other behavior would result in the "change" event
			//	being raised for the list property.  Since we don't want to record this as a true observable
			//	change, raise the event manually so that rules will still run as needed.
			// This occurs before batch end so that it functions like normal object loading.
			prop._raiseEvent("changed", [owner, { property: prop, newValue: list, oldValue: undefined, wasInited: true, collectionChanged: true}]);

			ExoWeb.Batch.end(batch);
			callback.call(thisPtr || this, list);

		}

		objectsFromJson(model, objectJson, function() {
			if (conditionsJson) {
				conditionsFromJson(model, conditionsJson, done);
			}
			else {
				done();
			}
		});
	});
}

ListLazyLoader.mixin({
	load: listLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(list) { return [list]; } /*, debug: true, debugLabel: "ListLazyLoader"*/ })
});

(function() {
	var instance = new ListLazyLoader();

	ListLazyLoader.register = function(obj, prop) {
		var list = [];

		list._ownerId = prop.get_isStatic() ? STATIC_ID : obj.meta.id;
		list._ownerProperty = prop;

		ExoWeb.Model.LazyLoader.register(list, instance);

		return list;
	};

	ListLazyLoader.unregister = function(list) {
		ExoWeb.Model.LazyLoader.unregister(list, instance);

		delete list._ownerId;
		delete list._ownerType;
		delete list._ownerProperty;
	};
})();
