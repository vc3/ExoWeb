﻿Type.registerNamespace("ExoWeb.Mapper");

if (!ExoWeb.GetInstance){
	ExoWeb.GetInstance = function(type, id, paths, callback){
		console.log($format("stubbed fetching of data for type {0} with id {1} and paths {2}", [type, id, paths]));
		
		window.setTimeout(function() {
			//console.log("ExoWeb.GetInstance CALLBACK");
			callback(window.data.drivers.__data);	
		}, 2000);
	}
}

if (!ExoWeb.GetType){
	ExoWeb.GetType = function(type, callback){
		console.log($format("stubbed fetching of metadata for type {0}", [type]));
		
		window.setTimeout(function() {
			//console.log("fetchType " + typeName + " DONE");
			var stub = {};
			stub[type] = window.data.drivers.__metadata[type];
			callback(stub);
		}, 1000);
	}
}

(function() {

	function toWire(obj) {
		if (obj instanceof Array) {
			var wire = [];
			for (var i = 0; i < obj.length; ++i) {
				wire.push(toWire(obj[i]));
			}

			return wire;
		}
		else if (obj.constructor.formats && obj.constructor.formats.$wire) {
			return obj.constructor.formats.$wire.convert(obj);
		}
		else {
			return obj;
		}
	}

	function ServerSync(model) {
		this._queue = [];
		var _this = this;

		// update object
		model.addAfterPropertySet(function(obj, property, newVal) {
			_this.enqueue("update", obj, {
				property: property.get_name(),
				value: toWire(newVal)
			});
		});

		// add object
		model.addObjectRegistered(function(obj) {
			if (obj.meta.isNew)
				_this.enqueue("new", obj);
		});

		// delete object
		model.addObjectUnregistered(function(obj) {
			_this.enqueue("delete", obj);
		});

		// lists
		model.addListChanged(function(obj, property, changes) {

			for (var i = 0; i < changes.length; ++i) {
				var change = changes[i];

				var addl = {
					property: property.get_name(),
				};
					
				if(change.newStartingIndex >= 0 || addl.newItems) {
					addl.newStartingIndex = change.newStartingIndex;
					addl.newItems = toWire(change.newItems);
				}
				if(change.oldStartingIndex >= 0 || addl.oldItems) {
					addl.oldStartingIndex = change.oldStartingIndex;
					addl.oldItems = toWire(change.oldItems);
				}

				// add changes, convert objects to values
				_this.enqueue("list", obj, addl);
			}
		});
	}

	ServerSync.prototype = {
		enqueue: function(oper, obj, addl) {
			var entry = { oper: oper, type: obj.meta.type.get_fullName(), id: toWire(obj) };

			if (addl) {
				for (var i in addl) {
					entry[i] = addl[i];
				}
			}
			this._queue.push(entry);
			
			if(this.enableConsole && console && console.log) {
				var s = "";
				
				if(addl && addl.property)
					s += "." + addl.property;

				for(var key in addl){
					if(key != "property")
						s += "; " + key + "=" + addl[key];
				}
				
				console.log($format("{oper}: {type}({id}){addl}", {oper: entry.oper, type: entry.type, id: entry.id, addl: s}));
			}
		}
	}
	ExoWeb.Mapper.ServerSync = ServerSync;
	ServerSync.registerClass("ExoWeb.Mapper.ServerSync");

	///////////////////////////////////////////////////////////////////////////////
	function CallbackSet() {
		this._waitForAll = [];
		this._pending = 0;
		var _this = this;
		this._oneDoneFn = function() { CallbackSet.prototype.oneDone.apply(_this, arguments); };
	}
	
	CallbackSet.mixin({
		pending: function(callback) {
			this._pending++;
			//console.log($format("(+) {_pending}", this));

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
			//console.log($format("(-) {0}", [this._pending - 1]));
			
			if (--this._pending == 0) {
				while (this._waitForAll.length > 0)
					Array.dequeue(this._waitForAll).apply(this, arguments);
			}
		}
	});


	///////////////////////////////////////////////////////////////////////////
	function $loadData(data){
		console.log("loading data");
		
		try {
			var getType = function(type, id){
				if (id.indexOf("|") > 0)
					return id.substring(0, id.indexOf("|"));
				else
					return type;
			}
		
			// Note: load object depends on local "data" variable to access data for related objects
			var loadObject = function(obj, type, id, depth) {
				obj._loaded = true;

				// don't hang the browser
				if (depth > loadObject.MAX_DEPTH)
					throw ($format("Maximum recursion depth of {depth} was exceeded.", { depth: loadObject.MAX_DEPTH }));

				var typeData = data[type];
				if (!typeData) {
					// TODO: handle objects with no data present (i.e.: async fetch?)
					obj._loaded = "no data for type";
					return obj;
				}

				var objectData = typeData[id];

				if (!objectData) {
					// TODO: handle objects with no data present (i.e.: async fetch?)
					obj._loaded = "no data for id";
					return obj;
				}

				for (var propName in objectData) {
					var prop = obj.meta.property(propName);

					if (!prop) {
						console.log("unknown property " + propName);
						continue;
					}
					else {
						prop = prop.lastProperty();
					}

					var propType = prop.get_fullTypeName();
	
					if (typeof (objectData[prop]) == "undefined" || objectData[propName] == null) {
						prop.init(obj, null);
					}
					else {
						var ctor = prop.get_dataType(true);
						var propType = prop.get_typeName();

						if (!ctor) {
							// TODO: handle unknown types
							obj[prop.get_name()] = { type: "unknown", name: prop.get_fullTypeName(), data: objectData[propName] };
						}
						else if (ctor.meta) {
							if (prop.get_isList()) {
								var ids = objectData[propName];
								var list = [];

								if (ids.length == 1 && ids[0] == "deferred") {
									// TODO: handle deferred lists appropriately
									list.__deferred = true;
								}
								else{
									for (var i = 0; i < ids.length; i++) {
										var childId = ids[i];
										var childType = getType(propType, childId);
										var childCtor = window[childType];
										var child = new childCtor(childId);
										
										list.push(child);
										
										if (!child._loaded)
											loadObject(child, childType, childId, depth + 1);
									}
								}
								// TODO: is it ok that child list is assigned after while child value is assigned before?
								prop.init(obj, list);
							}
							else {
								var childId = objectData[propName];
								var childType = getType(propType, childId);
								var childCtor = window[childType];
								var child = new childCtor(childId);

								prop.init(obj, child);
								if (!child._loaded)
									loadObject(child, childType, childId, depth + 1);
							}
						}
						else {
							var format = prop.get_format();
							prop.init(obj, format ? format.convertBack(objectData[propName]) : objectData[propName]);
						}
					}
				}

				return obj;
			}

			loadObject.MAX_DEPTH = 10;
	
			for (var typeVar in data) {
				for (var id in data[typeVar]) {
					// should be one and the same but use id type for consistency
					var type = getType(typeVar, id);
					var ctor = window[type];
					if (!ctor) {
						// TODO: handle types that are not defined
						console.log($format("type \"{0}\" is not defined", [type]));
						continue;
					}

					var obj = new ctor(id);
					if (!obj._loaded)
						loadObject(obj, type, id, 0);
				}
			}
		}
		catch (e) {
			console.log(e);
		}
	}


	///////////////////////////////////////////////////////////////////////////////
	function fetchDerivedTypes(model, typeName, derivedTypes, callback){
		if (derivedTypes && derivedTypes instanceof Array && derivedTypes.length > 0){
			var derivedSignals = new CallbackSet();
			Array.forEach(derivedTypes, function(derivedType){
				console.log($format("{0} requires derived type {1}.", [typeName, derivedType]));
				if(!resolveType(derivedType))
					fetchType(model, derivedType, derivedSignals.pending());
			});
			derivedSignals.waitForAll(function(){
				console.log($format("{0} finished loading derived types.", [typeName]));
				callback();
			});
		}
		else {
			console.log($format("{0} no derived types required.", [typeName]));
			callback();
		}
	}
	
	function fetchBaseType(model, typeName, baseTypeName, callback){
		if (baseTypeName && !resolveType(baseTypeName)) {
			var baseSignal = new CallbackSet();
			console.log($format("{0} requires base type {1}.", [typeName, baseTypeName]));
			fetchType(model, baseTypeName, baseSignal.pending());
			baseSignal.waitForAll(function(){
				console.log($format("{0} got response that base type {1} is loaded.", [typeName, baseTypeName]));
				callback();
			});
		}
		else {
			console.log($format("{0} does not require a base type.", [typeName]));
			callback();
		}
	}

	function fetchType(model, typeName, callback) {
		// TODO: integrate with web service
		var requested = fetchType.requested[typeName];
		
		if(!requested) {
			requested = fetchType.requested[typeName] = new CallbackSet();
			var signalOthers = requested.pending();

			console.log($format("{0} has not been requested before.  fetching now.", [typeName]));
			ExoWeb.GetType(typeName, function(typeJson) {
				typeJson = typeJson[typeName];
				console.log($format("{0} response recieved from web service", [typeName]));
				
				var _typeName = typeName;
				var _typeJson = typeJson;
				var load = function(){
					return model.addType(_typeName, _typeJson.baseType, _typeJson.derivedTypes, _typeJson.properties).get_jstype();
				}
				
				fetchBaseType(model, typeName, typeJson.baseType, function(){
					if (typeJson.baseType)
						console.log($format("{0} can be loaded now that base type {1} is present", [typeName, typeJson.baseType]));
					else
						console.log($format("{0} can be loaded since it doesn't require a base type", [typeName]));
					
					var jstype = load();
					signalOthers();
					delete fetchType.requested[typeName];
					callback(jstype);
				});
			});
		}
		else {
			console.log($format("{0} has been requested.  waiting.", [typeName]));
			requested.waitForAll(function() {
				console.log($format("{0} has been fetched.  done waiting.", [typeName]));
				callback(resolveType(typeName))
			});
		}
	}
	fetchType.requested = {};
	
	function resolveType(typeName) {
		return window[typeName];
	}

	function resolvePaths(model, jstype, props, callback) {
		try{
			var propName = Array.dequeue(props);
			var prop = jstype.meta.property(propName);
			
			if(!prop)
				throw $format("{type}.{property} doesn't exist", {type: jstype.meta.get_fullName(), property: propName});
			
			if(!resolveType(prop.get_fullTypeName())) {
				fetchType(model, prop.get_fullTypeName(), function(resolved) {
					//console.log($format("resolvePaths {0}.{1} callback", [jstype.meta.get_fullName(), props]));
					
					// TODO: fetch derived types
					fetchDerivedTypes(model, resolved.meta.get_fullName(), resolved.meta._derivedTypes, function(){
						console.log($format("{0} can resolve paths now that derived types are loaded.", [resolved.meta.get_fullName()]));
					
						if (props.length > 0)
							resolvePaths(model, resolved, props, callback);
						else if(callback)
							callback();
					});
				});
			}
			else
				callback();
	
			//console.log($format("resolvePaths {0}.{1} RETURN", [jstype.meta.get_fullName(), props]));
		}
		catch (e) {
			console.log(e);
		}
	}

	function fetchTypes(model, query, callback) {
		var signal = new CallbackSet();
		
		function processPaths(jstype) {
			fetchDerivedTypes(model, query.from, jstype.meta._derivedTypes, function(){
				//console.log("processPaths " + jstype.meta.get_fullName());
				console.log($format("{0} can process paths now that derived types are loaded.", [query.from]));
				if(query.and) {
					Array.forEach(query.and, function(path) {
						resolvePaths(model, jstype, path.split("."), signal.pending());
					});
				}
			});
		}
		
		var rootType = resolveType(query.from);
		if(!rootType)
			fetchType(model, query.from, signal.pending(processPaths));
		else
			processPaths(rootType);
			
		signal.waitForAll(callback);
	}
	
	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $model(options, callback) {
		var model = new ExoWeb.Model.Model();
		
		var allSignals = new CallbackSet();
		
		var state = {};
		
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for(varName in options) {
			state[varName] = { signal: new CallbackSet() };
			allSignals.pending();
			
			(function(varName) {
				var query = options[varName];
				ExoWeb.GetInstance(query.from, query.id, query.and, state[varName].signal.pending(function(objectJson) {
					state[varName].objectJson = objectJson;
				}));
			})(varName);
		}
		
		// load types
		for(varName in options) {
			fetchTypes(model, options[varName], state[varName].signal.pending());
		}

		// process instances as they finish loading
		for(varName in options) {
			(function(varName) {
				state[varName].signal.waitForAll(function() {
					
					$loadData(state[varName].objectJson);
					
					var query = options[varName];
					var jstype = model.get_type(query.from).get_jstype();
					
					window[varName] = new jstype(query.id);
					
					allSignals.oneDone();
				})
			})(varName);
		}
		
		allSignals.waitForAll(function() {
			//finish up
			
			if(callback)
				callback();
		});
		
	}
	window.$model = $model;
	
	function $load(metadata, data) {
		var model = null;

		if (metadata) {
			model = new ExoWeb.Model.Model();

			function createWireFormat(jstype) {
				jstype.formats.$wire = new ExoWeb.Model.Format({
					convert: function(val) { return val.meta.id; },
					convertBack: function(str) { return jstype.meta.get(str); }
				});
			}

			for (var type in metadata) {
				var jstype = model.addType(type, metadata[type].baseType, metadata[type].derivedTypes, metadata[type].properties).get_jstype();
				createWireFormat(jstype, type);
			}
		}

		if (data) {
			$loadData(data);
		}

		return model;
	}
	window.$load = $load;
})();
