﻿Type.registerNamespace("ExoWeb.Model");


//////////////////////////////////////////////////////////////////////////////////////
function Model()
{
	this._types = {};
	
	this._validatedQueue = new EventQueue(
					function(e)
					{
						e.sender._raisePropertyValidated(e.property);
					},
					function(a, b)
					{
						return a.sender == b.sender && a.property == b.property;
					}
				);

	this.__type = "Model";
}

Model.prototype.addType = function(name, baseClass, properties) {
	var jstype = window[name];
	
	if (!jstype) {
		window[name] = jstype = function(id) {

			// TODO
			this.meta = new ModelObject(this.type, this);

			if (id) {
				var obj = this.type.get(id);

				if (obj)
					return obj;
			}

			this.type.register(this, id);
		};
	}

	if (baseClass) {
		if (typeof (baseClass) == "string")
			baseClass = window[baseClass];
		jstype.prototype = new baseClass;
	}

	var type = new ModelType(jstype, name);
	type.set_model(this);
	type.define(properties);

	this._types[name] = type;

	jstype.prototype.type = type;
}

Model.prototype.get_validatedQueue = function()
{
	return this._validatedQueue;
}


//////////////////////////////////////////////////////////////////////////////////////
function ModelType(jstype, fullName)
{
	this._rules = [];
	this._jstype = jstype;
	this._fullName = fullName;
	this._pool = {};
	this._counter = 0;
	this._properties = {};

	this.__type = "ModelType";
}

ModelType.prototype.newId = function() {
	return "?" + this._counter++;
}

ModelType.prototype.register = function(obj, id) {
	for (var prop in this._properties)
		obj[prop] = null;

	if (!id) {
		id = this.newId();
		obj._new = true;
	}

	obj.meta.id = id.toString();

	Sys.Observer.makeObservable(obj);

	this._pool[id.toString()] = obj;
}

ModelType.prototype.get = function(id) {
	return this._pool[id];
}

ModelType.prototype.define = function(properties)
{
	for (var propName in properties)
		this.addProperty(propName, properties[propName]);
}

ModelType.prototype.addProperty = function(propName, def) {
	var prop = new ModelProperty(propName, def.type, def.label, def.format ? def.type.formats[def.format] : null, def.allowed);
	prop.set_containingType(this);

	this._properties[propName] = prop;

	// modify jstype to include functionality based on the type definition
	this._jstype["$" + propName] = prop;

	// add members to all instances of this type
	this._jstype.prototype["$" + propName] = prop;
//	this._jstype.prototype["get_" + propName] = this._makeGetter(prop, prop.getter);
//	this._jstype.prototype["set_" + propName] = this._makeSetter(prop, prop.setter);
}

ModelType.prototype._makeGetter = function(receiver, fn)
{
	return function()
	{
		return fn.call(receiver, this);
	}
}

ModelType.prototype._makeSetter = function(receiver, fn)
{
	return function(val)
	{
		fn.call(receiver, this, val);
	}
}

ModelType.prototype.set_model = function(val)
{
	this._model = val;
}

ModelType.prototype.get_model = function()
{
	return this._model;
}

ModelType.prototype.get_fullName = function()
{
	return this._fullName;
}

ModelType.prototype.get_jstype = function()
{
	return this._jstype;
}

ModelType.prototype.property = function(name)
{
	return this._properties[name];
}

ModelType.prototype.rule = function(inputs, func, async, issues)
{
	var rule = new ModelRule(async, func);

	for (var i = 0; i < inputs.length; ++i)
	{
		var propName = inputs[i].get_name();
		var rules = this._rules[propName];

		if (!rules)
		{
			rules = [rule];
			this._rules[propName] = rules;
		}
		else
			rules.push(rule);
	}

	if (issues)
		for (var i = 0; i < issues.length; ++i)
			issues[i].set_origin(rule);
}

ModelType.prototype.constraint = function(condition, issueDesc)
{
	var type = this;
	var issueProps = [];

	// update description and discover the properties the issue should be bound to
	issueDesc = issueDesc.replace(/\$([a-z0-9_]+)/ig,
					function(s, propName)
					{
						// TODO: handle multi hops
						var prop = type.property(propName);

						if ($.inArray(prop, issueProps) < 0)
							issueProps.push(prop);

						return prop.get_label();
					}
				);

	var inputProps = ModelRule.inferInputs(this, condition);

	var err = new ModelIssue(issueDesc, issueProps);

	type.rule(
					inputProps,
					function(obj)
					{
						obj.meta.issueIf(err, !condition.apply(obj));
					},
					false,
					[err]);

	return this;
}

// Executes all rules that have a particular property as input
ModelType.prototype.executeRules = function(obj, prop, start)
{
	var i = (start ? start : 0);
	var processing;

	var rules = this._rules[prop];

	if (rules)
	{
		while (processing = (i < rules.length))
		{
			var rule = rules[i];
			if (!rule._isExecuting)
			{
				rule._isExecuting = true;

				if (rule.isAsync)
				{
					// run rule asynchronously, and then pickup running next rules afterwards
					var _this = this;
					rule.execute(obj, function(obj)
					{
						rule._isExecuting = false;
						_this.executeRules(obj, prop, i + 1);
					});
					break;
				}
				else
				{
					try
					{
						rule.execute(obj);
					}
					finally
					{
						rule._isExecuting = false;
					}
				}
			}

			++i;
		}
	}

	if (!processing)
		this._model.get_validatedQueue().raise();
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelProperty(name, dataType, label, format, allowedValues)
{
	this._name = name;
	this._dataType = dataType;
	this._label = label;
	this._format = format;
	this._allowedValues = allowedValues;

	this.__type = "ModelProperty";

	// ???
	//var prop = this;
}

ModelProperty.prototype.toString = function()
{
	return this.get_label();
}

function Property(name, dataType)
{
	return new ModelProperty(name, dataType);
}

ModelProperty.prototype.set_containingType = function(type)
{
	this._containingType = type;
}

ModelProperty.prototype.get_containingType = function()
{
	return this._containingType;
}

ModelProperty.prototype.get_dataType = function()
{
	return this._dataType;
}

ModelProperty.prototype.get_allowedValues = function() {
	return this._allowedValues;
}

ModelProperty.prototype.get_format = function()
{
	return this._format;
}


ModelProperty.prototype.getter = function(obj)
{
	return obj[this._name];
}

ModelProperty.prototype.setter = function(obj, val)
{
	// TODO: validate val is correct datatype for manual calls to the setter
	if (this._ERR_ORIGIN_FORMAT)
		obj.meta.clearIssues(this._ERR_ORIGIN_FORMAT);

	if (val instanceof FormatIssue)
	{
		if (!this._ERR_ORIGIN_FORMAT)
			this._ERR_ORIGIN_FORMAT = {};

		issue = new ModelIssue(
						$format(val.get_message(), { value: this.get_label() }),
						[this],
						this._ERR_ORIGIN_FORMAT);

		obj.meta.issueIf(issue, true);
	}

	obj[this._name] = val;
}

ModelProperty.prototype.get_label = function()
{
	if (this._label)
		return this._label;

	return this._name;
}

ModelProperty.prototype.get_name = function()
{
	return this._name;
}

ModelProperty.prototype.get_uniqueName = function()
{
	return this.get_containingType().get_fullName() + "$" + this._name;
}

ModelProperty.prototype.label = function(val)
{
	this._label = val;
	return this;
}


ModelProperty.prototype.value = function(obj, val)
{
	if (arguments.length == 2)
	{
		Sys.Observer.setValue(obj, this._name, val);
		return val;
	}
	else
		return obj[this._name];
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelObject(type, obj)
{
	this._obj = obj;
	this._type = type;
	this._issues = [];
	this._propertyIssues = {};
	this._propertyValidated = {};
	this._propertyValidating = {};

	this.__type = "ModelObject";

	// watch for changes to object's state
	Sys.Observer.makeObservable(obj);
	Sys.Observer.addPropertyChanged(obj, this._propertyChanged);
}

ModelObject.prototype._propertyChanged = function(sender, e)
{
	var propName = e.get_propertyName();
	var meta = sender.meta;

	meta._type.get_model().get_validatedQueue().push({ sender: meta, property: propName });
	meta._raisePropertyValidating(propName);
	meta._type.executeRules(sender, propName);
}


ModelObject.prototype.property = function(propName)
{
	return this._type.property(propName);
}

ModelObject.prototype.clearIssues = function(origin)
{
	var issues = this._issues;

	for (var i = issues.length - 1; i >= 0; --i)
	{
		var issue = issues[i];

		if (issue.get_origin() == origin)
		{
			this._removeIssue(i);
			this._queuePropertiesValidated(issue.get_properties());
		}
	}
}

ModelObject.prototype.issueIf = function(issue, condition)
{
	// always remove and re-add the issue to preserve order
	var idx = $.inArray(issue, this._issues);

	if (idx >= 0)
		this._removeIssue(idx);

	if (condition)
		this._addIssue(issue);

	if ((idx < 0 && condition) || (idx >= 0 && !condition))
		this._queuePropertiesValidated(issue.get_properties());
}

ModelObject.prototype._addIssue = function(issue)
{
	this._issues.push(issue);

	// update _propertyIssues
	var props = issue.get_properties();
	for (var i = 0; i < props.length; ++i)
	{
		var propName = props[i].get_name();
		var pi = this._propertyIssues[propName];

		if (!pi)
		{
			pi = [];
			this._propertyIssues[propName] = pi;
		}

		pi.push(issue);
	}
}

ModelObject.prototype._removeIssue = function(idx)
{
	var issue = this._issues[idx];
	this._issues.splice(idx, 1);

	// update _propertyIssues
	var props = issue.get_properties();
	for (var i = 0; i < props.length; ++i)
	{
		var propName = props[i].get_name();
		var pi = this._propertyIssues[propName];

		var piIdx = $.inArray(issue, pi);
		pi.splice(piIdx, 1);
	}
}

ModelObject.prototype.issues = function(prop)
{
	if (!prop)
		return this._issues;

	var ret = [];

	for (var i = 0; i < this._issues.length; ++i)
	{
		var issue = this._issues[i];
		var props = issue.get_properties();

		for (var p = 0; p < props.length; ++p)
		{
			if (props[p] == prop)
			{
				ret.push(issue);
				break;
			}
		}
	}

	return ret;
}

ModelObject.prototype._queuePropertiesValidated = function(properties)
{
	var queue = this._type.get_model().get_validatedQueue();

	for (var i = 0; i < properties.length; ++i)
		queue.push({ sender: this, property: properties[i].get_name() });
}

ModelObject.prototype._raisePropertyValidated = function(propName)
{
	var handlers = this._propertyValidated[propName];

	if (typeof (handlers) != "undefined")
	{
		var issues = this._propertyIssues[propName];
		handlers(this, issues ? issues : []);
	}
}

ModelObject.prototype.addPropertyValidated = function(property, handler)
{
	var handlers = this._propertyValidated[property];

	if (typeof (handlers) == "undefined")
		this._propertyValidated[property] = handlers = Functor();

	handlers.add(handler);
}

ModelObject.prototype._raisePropertyValidating = function(property)
{
	var handlers = this._propertyValidating[property];

	if (typeof (handlers) != "undefined")
		handlers(this);
}

ModelObject.prototype.addPropertyValidating = function(property, handler)
{
	var handlers = this._propertyValidating[property];

	if (typeof (handlers) == "undefined")
		this._propertyValidating[property] = handlers = Functor();

	handlers.add(handler);
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelRule(isAsync, code)
{
	this.isAsync = isAsync;
	this._code = code;
}

ModelRule.inferInputs = function(rootType, func)
{
	var inputs = [];
	var match;

	while (match = /this\.([a-zA-Z0-9_]+)/g.exec(func.toString()))
	{
		// TODO: handle multi hops
		inputs.push(rootType.property(match[1]));
	}

	return inputs;
}

ModelRule.prototype.execute = function(obj, callback)
{
	if (!this.isAsync)
		this._code(obj);
	else
		this._code(obj, callback);
}

ModelProperty.prototype.asyncRule = function(func, issues)
{
	this._containingType.rule([this], func, true, issues);
	return this;
}

ModelProperty.prototype.rule = function(func, issues)
{
	this._containingType.rule([this], func, false, issues);
	return this;
}

ModelProperty.prototype.calculated = function(func)
{
	var prop = this;

	var inputs = ModelRule.inferInputs(this._containingType, func);

	this._containingType.rule(
					inputs,
					function(obj)
					{
						Sys.Observer.setValue(obj, prop._name, func.apply(obj));
					},
					false
				);

	return this;
}

ModelProperty.prototype.range = function(min, max)
{
	var prop = this;
	var err = null;
	var fn = null;

	var hasMin = (typeof (min) != "undefined" && min != null);
	var hasMax = (typeof (max) != "undefined" && max != null);

	if (hasMin && hasMax)
	{
		err = new ModelIssue(prop.get_label() + " must be between " + min + " and " + max, [prop]);
		fn = function(obj)
		{
			var val = prop.value(obj);
			obj.meta.issueIf(err, val < min || val > max);
		}
	}
	else if (hasMin)
	{
		err = new ModelIssue(prop.get_label() + " must be at least " + min, [prop]);
		fn = function(obj)
		{
			var val = prop.value(obj);
			obj.meta.issueIf(err, val < min);
		}
	}
	else if (hasMax)
	{
		err = new ModelIssue(prop.get_label() + " must no more than " + max, [prop]);
		fn = function(obj)
		{
			var val = prop.value(obj);
			obj.meta.issueIf(err, val > max);
		}
	}

	return fn ? prop.rule(fn, [err]) : this;
}

ModelProperty.prototype.required = function()
{
	var prop = this;
	var err = new ModelIssue(prop.get_label() + " is required", [prop]);

	return prop.rule(function(obj)
	{
		var val = prop.value(obj);
		obj.meta.issueIf(err, val == null || (String.trim(val.toString()) == ""));
	},
	[err]);
}

ModelProperty.prototype.format = function(pattern, description)
{
	var prop = this;
	var err = new ModelIssue(prop.get_label() + " must be formatted as " + description, [prop]);

	return prop.rule(function(obj)
	{
		var val = prop.value(obj);
		obj.meta.issueIf(err, !pattern.test(val));
	},
	[err]);
}

ModelProperty.prototype.phone = function(description)
{
	return this.format(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/, description ? description : "###-###-####");
}

ModelProperty.prototype.get_fromString = function()
{
	var _this = this;
	return function(str)
	{
		if (_this._converter && _this._converter.fromString)
			return _this._converter.fromString(str);

		return null;
	}
}

ModelProperty.prototype.serverRules = function(errorProbability)
{
	var prop = this;
	var randomErr = new ModelIssue("p=" + errorProbability, [prop]);

	return this.asyncRule(function(obj, callback)
	{
		// remove all current server issues
		obj.meta.clearIssues(this);

		if (obj.meta.issues(prop).length > 0)
		{
			// if there are already issues with this property then do nothing
			callback();
		}
		else
		{
			// callback when complete
			window.setTimeout(function()
			{
				obj.meta.issueIf(randomErr, Math.random() < errorProbability);
				callback();
			}, 1000);  // simulate server call
		}
	},
				[randomErr]);
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelDataType(name, toString, fromString)
{
	this._name = name;
	this._toString = toString;
	this._fromString = fromString;
}

ModelDataType.prototype.get_name = function()
{
	return this._name;
}


//////////////////////////////////////////////////////////////////////////////////////
function EventQueue(raise, areEqual)
{
	this._queue = [];
	this._raise = raise;
	this._areEqual = areEqual;
}

EventQueue.prototype.push = function(item)
{
	// don't double queue items...
	if (this._areEqual)
	{
		for (var i = 0; i < this._queue.length; ++i)
		{
			if (this._areEqual(item, this._queue[i]))
				return;
		}
	}

	this._queue.push(item);
}

EventQueue.prototype.raise = function()
{
	try
	{
		for (var i = 0; i < this._queue.length; ++i)
			this._raise(this._queue[i]);
	}
	finally
	{
		if (this._queue.length > 0)
			this._queue = [];
	}
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelIssue(message, relatedProperties, origin)
{
	this._properties = relatedProperties || [];
	this._message = message;
	this._origin = origin;
}

ModelIssue.prototype.get_properties = function()
{
	return this._properties;
}

ModelIssue.prototype.get_message = function()
{
	return this._message;
}

ModelIssue.prototype.get_origin = function()
{
	return this._origin;
}

ModelIssue.prototype.set_origin = function(origin)
{
	this._origin = origin;
}

ModelIssue.prototype.equals = function(o)
{
	return o.property.equals(this.property) && o._message.equals(this._message);
}

//////////////////////////////////////////////////////////////////////////////////////
function FormatIssue(message, invalidValue)
{
	this._message = message;
	this._invalidValue = invalidValue;
}

FormatIssue.prototype.get_message = function()
{
	return this._message;
}

FormatIssue.prototype.toString = function()
{
	return this._invalidValue;
}

FormatIssue.prototype.get_invalidValue = function()
{
	return this._invalidValue;
}

//////////////////////////////////////////////////////////////////////////////////////
function Format(options) {
	this._convert = options.convert;
	this._convertBack = options.convertBack;
	this._description = options.description;
}

Format.prototype = {
	convert: function(val) {
		if (typeof (val) == "undefined" || val == null)
			return "";

		if (val instanceof FormatIssue)
			return val.get_invalidValue();

		if (!this._convert)
			return val;

		return this._convert(val);
	},
	convertBack: function(str) {
		if (!str)
			return null;

		str = $.trim(str);

		if (str.length == 0)
			return null;

		if (!this._convertBack)
			return str;

		try {
			return this._convertBack(str);
		}
		catch (err) {
			return new FormatIssue(this._description ?
							"{value} must be formatted as " + this._description :
							"{value} is not properly formatted",
							str);
		}
	}
}

//////////////////////////////////////////////////////////////////////////////////////
function VC3Binding()
{ }

VC3Binding.getElementBindings = function(el)
{
	var bindings = el.__msajaxbindings;

	if (typeof (bindings) == "undefined")
		return [];

	for (var i = 0; i < bindings.length; ++i)
		$.extend(bindings[i], VC3Binding.prototype);

	return bindings;
}

// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
VC3Binding.prototype.get_finalSourceObject = function()
{
	var src = this.get_source();

	for (var i = 0; i < this._pathArray.length - 1; ++i)
		src = src[this._pathArray[i]];

	return src;
};

VC3Binding.prototype.get_finalPath = function()
{
	return this._pathArray[this._pathArray.length - 1];
};

//////////////////////////////////////////////////////////////////////////////////////
function Functor()
{
	var funcs = [];

	var f = function()
	{
		for (var i = 0; i < funcs.length; ++i)
			funcs[i].apply(this, arguments);
	};

	f._funcs = funcs;
	f.add = Functor.add;
	f.remove = Functor.remove;

	return f;
}

Functor.add = function()
{
	for (var i = 0; i < arguments.length; ++i)
	{
		var f = arguments[i];

		if (f == null)
			continue;

		this._funcs.push(f);
	}
}

Functor.remove = function(old)
{
	for (var i = this._funcs.length - 1; i >= 0; --i)
	{
		if (this._funcs[i] === old)
		{
			this._funcs.splice(i, 1);
			break;
		}
	}
}


//////////////////////////////////////////////////////////////////////////////////////
// utilities			
Date.prototype.subtract = function(d)
{
	var diff = this - d;

	var milliseconds = Math.floor(diff % 1000);
	diff = diff / 1000;
	var seconds = Math.floor(diff % 60);
	diff = diff / 60;
	var minutes = Math.floor(diff % 60);
	diff = diff / 60;
	var hours = Math.floor(diff % 24);
	diff = diff / 24;
	var days = Math.floor(diff);

	return { days: days, hours: hours, minutes: minutes, seconds: seconds, milliseconds: milliseconds };
}

function $format(str, values)
{
	return str.replace(/{([a-z0-9_]+)}/ig, function(match, name)
	{
		var val = values[name];

		if (val === null)
			return "";
		if (typeof (val) == "undefined")
			return match;

		return val.toString();
	});
}

function $load(metadata, data) {
	var model = null;

	if (metadata) {
		model = new Model();
		
		for (var type in metadata) {
			model.addType(type, null, metadata[type].attributes);
		}
	}

	if (data) {
		
		// Note: load object depends on local "data" variable to access data for related objects
		var loadObject = function(obj, type, id, depth) {
			obj._loaded = true;

			// don't hang the browser
			if (depth > loadObject.MAX_DEPTH)
				throw ($format("Maximum recursion depth of {depth} was exceeded.", { depth: loadObject.MAX_DEPTH }));

			var d = data[type][id];

			for (var prop in d) {
				var propType = obj.type.property(prop).get_dataType();
				if ((typeof (d[prop]) === "object" || typeof (d[prop]) === "string") &&
					propType != String && propType != Date && propType != Number) {

					if (propType.indexOf("|") >= 0) {
						var typeDef = propType.split("|");
						var mult = typeDef[0];
						var relType = typeDef[1];

						if (mult == "One") {
							var ctor = window[relType];
							var related = obj[prop] = new ctor(d[prop]);
							if (!related._loaded) {
								loadObject(related, relType, d[prop], depth + 1);
							}
						}
						else if (mult == "Many") {
							var src = d[prop];
							var dst = obj[prop] = [];
							for (var i = 0; i < src.length; i++) {
								var ctor = window[relType];
								var child = dst[dst.length] = new ctor(src[i]);
								if (!child._loaded) {
									loadObject(child, relType, src[i], depth + 1);
								}
							}
						}
						else {
							throw ($format("Unknown multiplicity \"{mult}\".", { mult: mult }));
						}
					}
				}
				else {
					obj[prop] = d[prop];
				}
			}

			return obj;
		}

		loadObject.MAX_DEPTH = 10;

		for (var type in data) {
			var ctor = window[type];
			for (var id in data[type]) {
				var obj = new ctor(id);
				if (!obj._loaded) {
					loadObject(obj, type, id, 0);
				}
			}
		}
	}

	return model;
}

; (function() {

	function getAdapter(component, targetProperty, templateContext, properties) {

		var prop = templateContext.dataItem.meta.property(properties.path || properties.$default);
		var dt = prop.get_dataType();

		var format;

		if (properties.format)
			format = dt.formats[properties.format];
		else if (!(format = prop.get_format()))
			format = dt.formats.$default;

		delete properties.$default;

		return new ExoWeb.Model.Adapter(templateContext.dataItem, prop, format, properties);
	}

	// Markup Extension
	//////////////////////////////////////////////////////////////////////////////////////
	Sys.Application.registerMarkupExtension("@=",
		function(component, targetProperty, templateContext, properties) {
			var adapter = getAdapter(component, targetProperty, templateContext, properties);

			var options = {
				source: adapter,
				path: "value",
				templateContext: templateContext,
				target: component,
				targetProperty: targetProperty
			};

			var binding = Sys.Binding.bind(options);
			templateContext.components.push(binding);
		},
		false
	);

	Sys.Application.registerMarkupExtension("@", getAdapter, true);
	
})();

// Type Format Strings
/////////////////////////////////////////////////////////////////////////////////////////////////////////

//TODO: number formatting include commas
Number.formats = {
	Integer: new Format({
		description: "#,###",
		convert: function(val) {
			return Math.round(val).toString();
		},
		convertBack: function(str) {
			if (!/^([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)$/.test(str))
				throw "invalid format";

			return parseInt(str, 10);
		}
	}),
	Float: new Format({
		description: "#,###.#",
		convert: function(val) {
			return val.toString();
		},
		convertBack: function(str) {
			return parseFloat(str);
		}
	})
}

Number.formats.$default = Number.formats.Float;

String.formats = {
	Phone: new Format({
		description: "###-###-####",
		convertBack: function(str) {
			if (!/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(str))
				throw "invalid format";

			return str;
		}
	}),
	$default: new Format({ })
}

Boolean.formats = {
	YesNo: new Format({
		convert: function(val) { return val ? "yes" : "no"; },
		convertBack: function(str) { return str == "yes"; }
	})
};

Boolean.formats.$default = Boolean.formats.YesNo;

Date.formats = {
	ShortDate: new Format({
		description: "mm/dd/yyyy",
		convert: function(val) {
			return val.format("MM/dd/yyyy");
		},
		convertBack: function(str) {
			var val = Date.parseInvariant(str);

			if (val != null)
				return val;

			throw "invalid date";
		}
	})
}

Date.formats.$default = Date.formats.ShortDate;


ExoWeb.Model.Adapter = function(target, property, format, options) {
	this._target = target;
	this._property = property;
	this._format = format;

	if (options) {
		for (var opt in options) {
			if (!this[opt])
				this[opt] = options[opt];
			else
				throw ($format("{opt} is already defined.", { opt: opt }));
		}
	}

	Sys.Observer.makeObservable(this);

	var _this = this;
	Sys.Observer.addPropertyChanged(this._target, function(sender, args) { _this._onTargetChanged(sender, args); });
}

ExoWeb.Model.Adapter.prototype = {
	_onTargetChanged: function(sender, args) {
		if (args.get_propertyName() == this._property.get_name()) {
			Sys.Observer.raisePropertyChanged(this, "value");
		}
	},
	get_target: function() {
		return this._target;
	},
	get_property: function() {
		return this._property;
	},
	get_label: function() {
		return this.label || this._property.get_label();
	},
	get_helptext: function() {
		return this.helptext || "";
	},
	get_value: function() {
		if (this._badValue)
			return this._badValue;

		var value = this._property.value(this._target);

		return (this._format) ? this._format.convert(value) : value;
	},
	set_value: function(value) {
		var converted = (this._format) ? this._format.convertBack(value) : value;

		this._target.meta.clearIssues(this);

		if (converted instanceof FormatIssue) {
			this._badValue = value;

			issue = new ModelIssue(
							$format(converted.get_message(), { value: this._property.get_label() }),
							[this._property],
							this);

			var meta = this._target.meta;
			var propName = this._property.get_name();

			// TODO:	 refactor this?
			meta.issueIf(issue, true);
			meta._type.get_model().get_validatedQueue().push({ sender: meta, property: propName });
			meta._raisePropertyValidating(propName);

			// run the rules to preserve the order of issues
			meta._type.executeRules(this._target, propName);
		}
		else {
			this._property.value(this._target, converted);

			delete this._badValue;
		}
	},
	addPropertyValidating: function(propName, handler) {
		this._target.meta.addPropertyValidating(this._property.get_name(), handler);
	},
	addPropertyValidated: function(propName, handler) {
		this._target.meta.addPropertyValidated(this._property.get_name(), handler);
	},
	toString: function() {
		return this.get_value();
	}
}

