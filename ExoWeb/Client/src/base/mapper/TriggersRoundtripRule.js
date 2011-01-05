function TriggerRoundtripRule(property) {
	var prop = this.prop = property;

	ExoWeb.Model.Rule.register(this, [property], true);
}

TriggerRoundtripRule.prototype = {
	execute: function(obj, callback) {
		ServerSync.Roundtrip(obj, callback, callback);
	},
	toString: function() {
		return "trigger roundtrip";
	}
};

ExoWeb.Mapper.TriggerRoundtripRule = ExoWeb.Model.Rule.triggerRoundtrip = TriggerRoundtripRule;

ExoWeb.Model.Property.mixin({
	triggersRoundtrip: function() {
		var rule = new TriggerRoundtripRule(this);
	}
});
