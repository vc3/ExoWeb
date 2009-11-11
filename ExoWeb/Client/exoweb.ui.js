Type.registerNamespace("VC3.UI");


///////////////////////////////////////////////////////////////////////////////
/// <summary>
/// The purpose of the template control is to define a UI "template" that can
/// determine whether or not it should be selected as a template for a given
/// DOM element.
/// </summary>
///
/// <example>
///		<div sys:attach="template" template:for="table.inputform tr" template:if="<some condition>"></div>
/// </example>
VC3.UI.Template = function(element) {
	VC3.UI.Template.initializeBase(this, [element]);
}

VC3.UI.Template.prototype = {
	get_for: function() {
		return this._for;
	},
	set_for: function(value) {
		this._for = value;
	},
	get_if: function() {
		return this._if;
	},
	set_if: function(value) {
		this._if = value;
	},
	matches: function(e) {
		return $(e).is(this.get_for());
	},
	initialize: function() {
		VC3.UI.Template.callBaseMethod(this, "initialize");

		// add a class that can be used to search for templates 
		// and make sure that the template element is hidden
		$(this.get_element()).addClass("vc3-template").hide();
	}
}

/// Finds the first field template with a selector that 
/// matches the given element and returns the template.
VC3.UI.Template.find = function(element) {
	// get the template by css selectors
	var templates = $(".vc3-template");
	for (var t = 0; t < templates.length; t++) {
		var tmpl = templates[t];
		if (VC3.UI.Template.isInstanceOfType(tmpl.control) && tmpl.control.matches(element))
			return tmpl;
	}

	return null;
}

VC3.UI.Template.registerClass("VC3.UI.Template", Sys.UI.Control);


///////////////////////////////////////////////////////////////////////////////
/// <summary>
/// The purpose of the content control is to find its matching template
/// and render using the provided data as the binding context.  It can be
/// used as a "field control", using part of the context data to select the
/// appropriate control template.  Another common usage would be to select
/// the appropriate template for a portion of the UI, as in the example where 
/// an objects meta type determines how it is displayed in the UI.
/// </summary>
///
/// <example>
///		<div sys:attach="content" content:data="{{ somedata }}"></div>
/// </example>
VC3.UI.Content = function(element) {
	VC3.UI.Content.initializeBase(this, [element]);
}

VC3.UI.Content.prototype = {
	get_template: function() {
		if (!this._template) {
			var element = this.get_element();
			this._template = VC3.UI.Template.find(element);

			if (!this._template) {
				throw ("This content region does not match any available templates.");
			}
		}

		if (!Sys.UI.Template.isInstanceOfType(this._template))
			this._template = new Sys.UI.Template(this._template);

		return this._template;
	},
	get_data: function() {
		return this._data;
	},
	set_data: function(value) {
		this._data = value;
	},
	render: function() {
		try {
			var ctx = this.get_template().instantiateIn(this.get_element(), null, this.get_data());
			
			// necessary in order to render components found within the template (like a nested dataview)
			ctx.initializeComponents();
		}
		catch (e) {
			alert(e);
		}
	},
	initialize: function() {
		VC3.UI.Content.callBaseMethod(this, "initialize");

		// TODO: include meta info about field?
		
		this.render();
	}
}

VC3.UI.Content.registerClass("VC3.UI.Content", Sys.UI.Control);


///////////////////////////////////////////////////////////////////////////////
VC3.UI.Field = function(element) {
	VC3.UI.Field.initializeBase(this, [element]);
}

VC3.UI.Field.prototype = {
	get_source: function() {
		return this._source;
	},
	set_source: function(value) {
		if (this._source !== value) {
			this._data = null;
			// TODO: can't tell whether label was inferred
			this._source = value;
			// TODO: do other stuff?
		}
	},
	get_label: function() {
		if (!this._label) {
			var label = this.get_source();

			// TODO: convert to a human-friendly format
			//		or retrieve from metadata

			this._label = label;
		}

		return this._label;
	},
	set_label: function(value) {
		this._label = value;
	},
	get_isReadOnly: function() {
		// TODO: verify that this actually returns a bool in all cases
		return this._isReadOnly || false;
	},
	set_isReadOnly: function(value) {
		if (this._isReadOnly !== value) {
			this._isReadOnly = value;

			// TODO: better bool conversion
			if (typeof (this._isReadOnly) == "string")
				this._isReadOnly = (this._isReadOnly.toLowerCase() == "true");
		}
	},
	get_data: function() {
		if (!this._data) {
			var ctx = this.findContext();
			var target = ctx.dataItem;
			var prop = target.meta.property(this.get_source());
			
			this._data = new ExoWeb.Model.Adapter(target, prop);
		}
		return this._data;
	},
	findContext: function(element) {
		/// Finds the containing template control for the given element and 
		/// then finds the element's corresponding context (for repeated content).

		var element = this.get_element();
		var container = null;
		var subcontainer = null;

		// find the first parent that is an ASP.NET Ajax template
		while (element.parentNode && !element.parentNode._msajaxtemplate)
			element = element.parentNode;

		// containing template was not found
		if (!element.parentNode || !element.parentNode._msajaxtemplate)
			throw Error.invalidOperation("Not within a container template.");

		container = element.parentNode;
		subcontainer = element;

		var contexts = container.control.get_contexts();
		if (contexts) {
			for (var i = 0, l = contexts.length; i < l; i++) {
				var ctx = contexts[i];
				if ((ctx.containerElement === container) && (Sys._indexOf(ctx.nodes, subcontainer) > -1)) {
					return ctx;
				}
			}
		}

		return null;
	}
}

VC3.UI.Field.registerClass("VC3.UI.Field", VC3.UI.Content);


///////////////////////////////////////////////////////////////////////////////
Type.registerNamespace("VC3.Data");

VC3.Data.DataContext = function VC3$Data$DataContext(rawData) {
	VC3.Data.DataContext.initializeBase(this);
	this._rawData = rawData;
	this.initialize();
}

VC3.Data.DataContext.prototype = {
	// TODO: temporary hack to allow using data context without service
	fetchData: function(operation, parameters, mergeOption, httpVerb, succeededCallback, failedCallback, timeout, userContext) {
		succeededCallback(this.get_graph());
	},
	get_root: function() {
		return this._root;
	},
	set_root: function(value) {
		this._root = value;
	},
	initialize: function() {
		$load(this._rawData.__metadata, this._rawData.__data);
	}
}

VC3.Data.DataContext.registerClass("VC3.Data.DataContext", Sys.Data.DataContext);





// Since this script is not loaded by System.Web.Handlers.ScriptResourceHandler
// invoke Sys.Application.notifyScriptLoaded to notify ScriptManager 
// that this is the end of the script.
if (typeof (Sys) !== 'undefined') Sys.Application.notifyScriptLoaded();
