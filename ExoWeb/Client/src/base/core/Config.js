var config = {
	// General debug setting that can encompose the purpose of other more focused settings.
	// Determines whether parts of the framework attempt to handle errors and throw more descriptive errors.
	debug: false,

	// Indicates that signal should use window.setTimeout when invoking callbacks. This is
	// done in order to get around problems with browser complaining about long-running script.
	signalTimeout: false,

	// The maximum number of pending signals to execute as a batch.
	// By default this is null, which means that no maximum is enforced.
	signalMaxBatchSize: null,

	// Causes the query processing to load model roots in the query individually. By default they are batch-loaded.
	individualQueryLoading: false,

	// Uniquely identifies this application if more than one app is hosted under the same domain name.
	appInstanceId: "?",

	// Controls different whether lazy loading are allowed. If set to false, an error is raised when lazy loading occurs.
	allowTypeLazyLoading: true,
	allowObjectLazyLoading: true,
	allowListLazyLoading: true
};

exports.config = config;
