function Binding(templateContext, source, sourcePath, target, targetPath, options, scopeChain) {
	Binding.initializeBase(this);

	this._templateContext = templateContext;
	this._source = source;
	this._sourcePath = sourcePath;
	this._target = target;

	var pathLower = targetPath ? targetPath.toLowerCase() : targetPath;
	if (pathLower === "innertext") {
		this._targetPath = "innerText";
	}
	else if (pathLower === "innerhtml") {
		this._targetPath = "innerHTML";
	}
	else {
		this._targetPath = targetPath;
	}

	this._options = options || {};

	this._isTargetElement = Sys.UI.DomElement.isDomElement(target);

	this._updateImmediately = true;

	if (this._sourcePath) {
		// Start the initial fetch of the source value.
		this._evalSuccessHandler = this._evalSuccess.bind(this);
		this._evalFailureHandler = this._evalFailure.bind(this);
		LazyLoader.eval(this._source, this._sourcePath, this._evalSuccessHandler, this._evalFailureHandler, scopeChain);
	}
	else {
		this._evalSuccess(this._source);
	}

	this._updateImmediately = false;
}

function ensureArray(value) {
	return isArray(value) ? value : (isNullOrUndefined(value) ? [] : [value]);
}

Binding.mixin({

	// Functions concerned with setting the value of the target after
	// the source value has been retrieved and manipulated based on options.
	//////////////////////////////////////////////////////////////////////////

	_setTarget: function(value) {
		if (this._isTargetElement && (this._targetPath === "innerText" || this._targetPath === "innerHTML")) {
			if (value && !isString(value))
				value = value.toString();

			// taken from Sys$Binding$_sourceChanged
			Sys.Application._clearContent(this._target);
			if (this._targetPath === "innerHTML")
				this._target.innerHTML = value;
			else
				this._target.appendChild(document.createTextNode(value));
			Observer.raisePropertyChanged(this._target, this._targetPath);
		}
		else if (this._isTargetElement && value === null) {
			// IE would set the value to "null"
			Observer.setValue(this._target, this._targetPath, "");
		}
		else {
			Observer.setValue(this._target, this._targetPath, value);
		}
	},

	_queue: function (value) {
		if (this._pendingValue) {
			this._pendingValue = value;
			return;
		}

		this._pendingValue = value;

		Batch.whenDone(function() {
			var targetValue = this._pendingValue;
			delete this._pendingValue;

			if (this._disposed === true) {
				return;
			}

			this._setTarget(targetValue);
		}, this);
	},

	// Functions that filter or transform the value of the source before
	// setting the target.  These methods are NOT asynchronous.
	//////////////////////////////////////////////////////////////////////////

	_getValue: function(value) {
		// Use a default value if the source value is null. NOTE: Because of the way LazyLoader.eval and evalPath are used,
		// the result should never be undefined. Undefined would indicate that a property did not exist, which would be an
		// error. This also has the side-effect of being more compatible with server-side rendering.
		if (value == null) {
			if (this._options.hasOwnProperty("nullValue")) {
				return this._options.nullValue;
			}
		}
		else {
			// Attempt to format the source value using a format specifier
			var format = this._options.format;
			if (format) {
				if (typeof format === "function") {
					return format(value);
				} else if (typeof format === "string") {
					return getFormat(value.constructor, format).convert(value);
				} else {
					throw new Error("Unknown format option '" + format + "' of type '" + (typeof format) + "'.");
				}
			}
			else if (this._options.transform) {
				// Generate the transform function
				if (!this._transformFn) {
					this._transformFn = new Function("list", "$index", "$dataItem", "return $transform(list, true)." + this._options.transform + ";");
				}
				// Transform the original list using the given options
				var transformResult = this._transformFn(value, this._templateContext.index, this._templateContext.dataItem);
				if (transformResult.live !== Transform.prototype.live) {
					throw new Error("Invalid transform result: may only contain \"where\", \"orderBy\", \"select\", \"selectMany\", and \"groupBy\".");
				}
				return transformResult.live();
			}
		}
		return value;
	},

	// Functions that deal with responding to changes, asynchronous loading,
	// and general bookkeeping.
	//////////////////////////////////////////////////////////////////////////

	_require: function (value, callback) {
		var valueRevision = this._valueRevision = ExoWeb.randomText(8, true),
			updateImmediately = true;

		LazyLoader.evalAll(value, this._options.required, function () {

			// Make sure that the data being evaluated is not stale.
			if (!this._value || this._value !== value || this._valueRevision !== valueRevision) {
				return;
			}

			if (updateImmediately) {
				callback.call(this);
			} else {
				window.setTimeout(callback.bind(this), 1);
			}
		}, null, null, this, LazyLoader.evalAll, false, value, [], true);

		updateImmediately = false;
	},

	_update: function (value, oldItems, newItems) {
		if (this._disposed === true) {
			return;
		}

		// if necessary, remove an existing collection change handler
		if (this._collectionChangedHandler) {
			Observer.removeCollectionChanged(this._value, this._collectionChangedHandler);
			delete this._value;
			delete this._collectionChangedHandler;
		}

		this._value = value;

		// if the value is an array and we will transform the value or require paths, then watch for collection change events
		if (value && value instanceof Array && this._options.required) {
			this._collectionChangedHandler = this._collectionChanged.bind(this);
			Observer.makeObservable(value);
			Observer.addCollectionChanged(value, this._collectionChangedHandler);
		}

		// If additional paths are required then load them before invoking the callback.
		if (this._options.required) {
			this._updateWatchedItems(value, oldItems, newItems, function() {
				this._queue(this._getValue(value));
			});
		}
		else {
			this._queue(this._getValue(value));
		}
	},
	
	_updateWatchedItems: function(value, oldItems, newItems, callback) {
		// Unwatch require path for items that are no longer relevant.
		if (oldItems && oldItems.length > 0) {
			oldItems.forEach(function(item) {
				Observer.removePathChanged(item, this._options.required, this._watchedItemPathChangedHandler);
			}, this);
			delete this._watchedItemPathChangedHandler;
		}

		if (value) {
			// Load required paths, then manipulate the source value and update the target.
			this._require(value, function() {
				if (this._disposed === true) {
					return;
				}

				if (newItems && newItems.length > 0) {
					// Watch require path for new items.
					this._watchedItemPathChangedHandler = this._watchedItemPathChanged.bind(this);
					forEach(newItems, function(item) {
						Observer.addPathChanged(item, this._options.required, this._watchedItemPathChangedHandler, true);
					}, this);
				}

				if (callback) {
					callback.call(this);
				}
			});
		}
		else if (callback) {
			callback.call(this);
		}
	},

	_collectionChanged: function(items, evt) {
		// In the case of an array-valued source, respond to a collection change that is raised for the source value.
		if (this._options.required) {
			var oldItems = evt.get_changes().mapToArray(function(change) { return change.oldItems || []; });
			var newItems = evt.get_changes().mapToArray(function(change) { return change.newItems || []; });
			this._updateWatchedItems(items, oldItems, newItems);
		}
	},

	_watchedItemPathChanged: function(sender, args) {
		this._update(this._sourcePathResult);
	},

	_sourcePathChanged: function() {
		// Save the previous result and evaluate and store the new one.
		var prevSourcePathResult = this._sourcePathResult;
		this._sourcePathResult = evalPath(this._source, this._sourcePath);

		// if the value is the same (which will commonly happen when the source is an array) then there is no need to update
		if (prevSourcePathResult !== this._sourcePathResult) {
			// Respond to a change that occurs at any point along the source path.
			this._update(this._sourcePathResult, ensureArray(prevSourcePathResult), ensureArray(this._sourcePathResult));
		}
	},

	_evalSuccess: function(result, performedLoading, source) {
		this._source = source;

		if (this._disposed) {
			return;
		}

		delete this._evalSuccessHandler;

		if (this._sourcePath) {
			this._sourcePathChangedHandler = this._sourcePathChanged.bind(this);
			Observer.addPathChanged(this._source, this._sourcePath, this._sourcePathChangedHandler, true);
		}

		this._sourcePathResult = result;

		if (this._updateImmediately) {
			this._update(result, null, ensureArray(result));
		} else {
			var self = this;
			window.setTimeout(function () {
				self._update(result, null, ensureArray(result));
			}, 1);
		}
	},

	_evalFailure: function(err) {
		if (this._disposed) {
			return;
		}

		delete this._evalFailureHandler;

		throw new Error($format("Couldn't evaluate path '{0}', {1}", this._sourcePath, err));
	},

	dispose: function() {
		if (!this._disposed) {
			this._disposed = true;
			if (this._collectionChangedHandler) {
				Observer.removeCollectionChanged(this._value, this._collectionChangedHandler);
				this._collectionChangedHandler = null;
			}
			if (this._sourcePathChangedHandler) {
				Observer.removePathChanged(this._source, this._sourcePath, this._sourcePathChangedHandler);
				this._sourcePathChangedHandler = null;
			}
			if (this._watchedItemPathChangedHandler) {
				ensureArray(this._sourcePathResult).forEach(function(item) {
					Observer.removePathChanged(item, this._options.required, this._watchedItemPathChangedHandler);
				}, this);
				this._watchedItemPathChangedHandler = null;
			}
			if (this._evalSuccessHandler) {
				this._evalSuccessHandler = null;
			}
			if (this._evalFailureHandler) {
				this._evalFailureHandler = null;
			}
			this._isTargetElement = this._options = this._pendingValue = this._source =
				this._sourcePath = this._sourcePathResult = this._target = this._targetPath =
				this._templateContext = this._transformFn = this._value = this._valueRevision = null;
		}
		Binding.callBaseMethod(this, "dispose");
	}

});

exports.Binding = Binding;
Binding.registerClass("ExoWeb.View.Binding", Sys.Component, Sys.UI.ITemplateContextConsumer);
