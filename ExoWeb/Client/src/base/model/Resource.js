﻿var Resource = {
	"allowed-values":							"{property} is not in the list of allowed values.",
	"compare-after":							"{property} must be after {compareSource}.",
	"compare-before":							"{property} must be before {compareSource}.",
	"compare-equal":							"{property} must be the same as {compareSource}.",
	"compare-greater-than":						"{property} must be greater than {compareSource}.",
	"compare-greater-than-or-equal":			"{property} must be greater than or equal to {compareSource}.",
	"compare-less-than":						"{property} must be less than {compareSource}.",
	"compare-less-than-or-equal":				"{property} must be less than or equal to {compareSource}.",
	"compare-not-equal":						"{property} must be different from {compareSource}.",
	"compare-on-or-after":						"{property} must be on or after {compareSource}.",
	"compare-on-or-before":						"{property} must be on or before {compareSource}.",
	"listlength-compare-equal":					"{property} length must be the same as {compareSource}.",
	"listlength-compare-greater-than":			"{property} length must be greater than {compareSource}.",
	"listlength-compare-greater-than-or-equal":	"{property} length must be greater than or equal to {compareSource}.",
	"listlength-compare-less-than":				"{property} length must be less than {compareSource}.",
	"listlength-compare-less-than-or-equal":	"{property} length must be less than or equal to {compareSource}.",
	"listlength-compare-not-equal":				"{property} length must be different from {compareSource}.",
	"range-at-least":							"{property} must be at least {min}.",
	"range-at-most":							"{property} must be at most {max}.",
	"range-between":							"{property} must be between {min} and {max}.",
	"range-on-or-after":						"{property} must be on or after {min}.",
	"range-on-or-before":						"{property} must be on or before {max}.",
	"required":									"{property} is required.",
	"required-if-after":						"{property} is required when {compareSource} is after {compareValue}.",
	"required-if-before":						"{property} is required when {compareSource} is before {compareValue}.",
	"required-if-equal":						"{property} is required when {compareSource} is {compareValue}.",
	"required-if-exists":						"{property} is required when {compareSource} is specified.",
	"required-if-greater-than":					"{property} is required when {compareSource} is greater than {compareValue}.",
	"required-if-greater-than-or-equal":		"{property} is required when {compareSource} is greater than or equal to {compareValue}.",
	"required-if-less-than":					"{property} is required when {compareSource} is less than {compareValue}.",
	"required-if-less-than-or-equal":			"{property} is required when {compareSource} is less than or equal to {compareValue}.",
	"required-if-not-equal":					"{property} is required when {compareSource} is not {compareValue}.",
	"required-if-not-exists":					"{property} is required when {compareSource} is not specified.",
	"required-if-on-or-after":					"{property} is required when {compareSource} is on or after {compareValue}.",
	"required-if-on-or-before":					"{property} is required when {compareSource} is on or before {compareValue}.",
	"string-format":							"{property} must be formatted as {formatDescription}.",
	"string-length-at-least":					"{property} must be at least {min} characters.",
	"string-length-at-most":					"{property} must be at most {max} characters.",
	"string-length-between":					"{property} must be between {min} and {max} characters.",

	// gets the resource with the specified name
	get: function Resource$get(name) {
		return this[name];
	}
}

// publicly export the resource object
exports.Resource = Resource;