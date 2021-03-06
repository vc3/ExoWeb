﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using ExoRule;
using ExoRule.Validation;
using System.Collections;
using ExoWeb.Templates.JavaScript;
using ExoWeb.Serialization;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Server-side representation of the client-side ExoWeb.View.Adapter class,
	/// which is used during binding to provide metadata about a bound property in the model.
	/// </summary>
	public class Adapter : IBindable
	{
		static readonly string[] disallowedProperties = new string[] {
			"isList", "isEntity", "isEntityList", "isStatic",
			"target", "propertyPath", "propertyChain", "dataType",
			// "format", -- overriding format property value is allowed
			// "label", -- overriding label property value is allowed
			"nullOption", // -- overriding nullOption property value is allowed only for booleans
			"allowedValuesRule", "allowedValues", "options", "selected",
			"helptext", "rawValue", "systemValue", "displayValue"
		};

		BindingResult binding;
		Transform allowedValuesTransform;
		Dictionary<string, string> properties;

		internal Adapter(BindingResult binding, IDictionary<string, string> parameters)
		{
			this.binding = binding;
			this.properties = new Dictionary<string,string>();

			if (parameters.ContainsKey("optionsTransform"))
				throw new ApplicationException(string.Format("Option \"optionsTransform\" is obsolete, use \"allowedValuesTransform\" instead. Path = \"{0}\".", binding.Property));

			// Compile the allowed values transform if one is specified
			if (parameters.ContainsKey("allowedValuesTransform"))
			{
				if (parameters["allowedValuesTransform"].Contains("groupBy("))
					throw new ApplicationException("The allowedValuesTransform property does not support grouping");

				this.allowedValuesTransform = Transform.Compile(parameters["allowedValuesTransform"]);
			}

			// Copy custom properties that are allowed
			foreach (string key in parameters.Keys)
			{
				var disallowed = disallowedProperties.Contains(key);

				// Allow overriding nullOption property for booleans.
				if (disallowed && key == "nullOption" && IsBoolean(Property))
					disallowed = false;

				if (!disallowed)
					this.properties.Add(key, parameters[key]);
			}
		}

		#region Properties
		/// <summary>
		/// The source value that the property path is evaluated against
		/// </summary>
		public ModelInstance Source
		{
			get
			{
				return binding.Source;
			}
		}

		/// <summary>
		/// The property represented by the path
		/// </summary>
		public ModelProperty Property
		{
			get
			{
				return binding.Property;
			}
		}

		/// <summary>
		/// The source object's value of the specified property
		/// </summary>
		public object RawValue
		{
			get
			{
				return binding.Value;
			}
		}

		/// <summary>
		/// The custom format, if specified
		/// </summary>
		public bool NullOption
		{
			get
			{
				if (IsBoolean(Property))
				{
					string nullOptionText;
					if (properties.TryGetValue("nullOption", out nullOptionText))
					{
						bool nullOption;
						return bool.TryParse(nullOptionText, out nullOption) && nullOption;
					}

					return false;
				}

				return true;
			}
		}

		/// <summary>
		/// The custom format, if specified
		/// </summary>
		public string Format
		{
			get
			{
				string format = null;
				properties.TryGetValue("format", out format);
				return format;
			}
		}

		/// <summary>
		/// Indicates whether the specified property is a list
		/// </summary>
		public bool IsList
		{
			get
			{
				return Property is ModelReferenceProperty && ((ModelReferenceProperty)Property).IsList;
			}
		}

		/// <summary>
		/// The custom lable, or the default property label if none is specified
		/// </summary>
		string Label
		{
			get
			{
				string label = null;
				if (!properties.TryGetValue("label", out label))
					label = binding.Property.Label;
				return label;
			}
		}

		/// <summary>
		/// The display (human-readable) representation of the value
		/// </summary>
		string DisplayValue
		{
			get
			{
				string value;
				TryGetDisplayValue(Property, Format, RawValue, out value);
				return value;
			}
		}

		/// <summary>
		/// The system (non-human-readable) representation of the value
		/// </summary>
		string SystemValue
		{
			get
			{
				string systemValue;
				TryGetSystemValue(Property, RawValue, out systemValue);
				return systemValue;
			}
		}

		/// <summary>
		/// The list of objects that represent options for the property.
		/// </summary>
		IEnumerable<object> Options
		{
			get
			{
				IEnumerable<object> options;
				TryGetAllowedValues(Property, Source, allowedValuesTransform, out options);
				return options;
			}
		}

		/// <summary>
		/// The list of conditions associated with the property.
		/// </summary>
		public IEnumerable<Condition> Conditions
		{
			get
			{
				var source = Source;
				if (source == null)
					return new Condition[] { };

				return Condition.GetConditions(source, ct => ct.Properties.Contains(Property.Name));
			}
		}

		/// <summary>
		/// Gets the first <see cref="Error"/>, if any, associated with the property.
		/// </summary>
		public Condition FirstError
		{
			get
			{
				return Conditions.FirstOrDefault(c => c.Type is Error);
			}
		}

		#endregion

		#region Methods

		internal static bool IsBoolean(ModelProperty property)
		{
			return property is ModelValueProperty && JsonConverter.GetJsonValueType(((ModelValueProperty) property).PropertyType) == "Boolean";
		}

		/// <summary>
		/// Attempts to retrieve 
		/// </summary>
		/// <param name="property"></param>
		/// <param name="source"></param>
		/// <param name="allowedValuesTransform"></param>
		/// <param name="rawOptions"></param>
		/// <returns></returns>
		internal static bool TryGetAllowedValues(ModelProperty property, ModelInstance source, Transform allowedValuesTransform, out IEnumerable<object> allowedValues)
		{
			allowedValues = null;

			var allowedInstances = AllowedValuesRule.GetAllowedValues(source, property);

			if (allowedInstances != null)
			{
				if (allowedValuesTransform != null)
				{
					IEnumerable transformed;
					if (allowedValuesTransform.TryExecute(Page.Current, allowedInstances, out transformed))
						allowedValues = transformed.Cast<object>().ToArray();
				}
				else
					allowedValues = allowedInstances;
			}
			else if (IsBoolean(property))
				allowedValues = new object[] { true, false };

			return allowedValues != null;
		}

		/// <summary>
		/// Attempts to format the given value using the given format, or the default format for the property.
		/// </summary>
		/// <param name="property"></param>
		/// <param name="format"></param>
		/// <param name="value"></param>
		/// <param name="displayValue"></param>
		/// <returns></returns>
		internal static bool TryGetDisplayValue(ModelProperty property, string format, object value, out string displayValue)
		{
			if (value == null)
				displayValue = "";
			else if (property is ModelValueProperty)
				displayValue = ((ModelValueProperty)property).FormatValue(value, format);
			else if (value is IEnumerable<ModelInstance>)
			{
				StringBuilder builder = new StringBuilder();
				foreach (ModelInstance instance in (IEnumerable<ModelInstance>)value)
				{
					string instanceValue;
					if (!instance.TryFormat(format ?? property.Format, out instanceValue))
					{
						displayValue = "";
						return false;
					}

					if (builder.Length > 0)
						builder.Append(", ");

					builder.Append(instanceValue);
				}

				displayValue = builder.ToString();
			}
			else if (value is ModelInstance)
				return ((ModelInstance)value).TryFormat(format ?? property.Format, out displayValue);
			else
				throw new ArgumentException("Cannot obtain a display value since the given object is invalid for the property.");

			return true;
		}

		/// <summary>
		/// Attempts to format the given value as a typed identifier
		/// </summary>
		/// <param name="value"></param>
		/// <param name="systemValue"></param>
		/// <returns></returns>
		internal static bool TryGetSystemValue(ModelProperty property, object value, out string systemValue)
		{
			if (property is ModelReferenceProperty)
				systemValue = value != null ? ((ModelInstance)value).Type.Name + "|" + ((ModelInstance)value).Id : null;
			else if (JsonConverter.GetJsonValueType(((ModelValueProperty)property).PropertyType) == "Boolean")
			{
				if (value is bool)
					systemValue = (bool)value ? "true" : "false";
				else if (value is bool?)
					systemValue = ((bool?)value).HasValue ? (((bool?)value).Value ? "true" : "false") : "";
				else
				{
					systemValue = "";
					return false;
				}
			}
			else
			{
				systemValue = value != null ? value.ToString() : "";
				return false;
			}

			return true;
		}
		
		/// <summary>
		/// Returns a value indicating whether the adapter
		/// defines a custom property of the given name
		/// </summary>
		/// <param name="prop"></param>
		/// <returns></returns>
		internal bool HasProperty(string name)
		{
			return properties.ContainsKey(name);
		}

		/// <summary>
		/// Gets a custom property of the given name
		/// </summary>
		/// <param name="name"></param>
		/// <returns></returns>
		internal string GetPropertyValue(string name)
		{
			string value = null;
			properties.TryGetValue(name, out value);
			return value;
		}

		#endregion

		#region IBindable

		BindingResult IBindable.Evaluate(string expression)
		{
			bool isValid = false;
			object value = null;

			switch (expression)
			{
				case "isList":
					isValid = true;
					value = IsList;
					break;
				case "label":
					isValid = true;
					value = Label;
					break;
				case "options":
					IEnumerable<object> allowedValues;
					if (isValid = TryGetAllowedValues(Property, Source, allowedValuesTransform, out allowedValues))
						value = allowedValues.Select(i => new OptionAdapter(this, i)).ToArray();
					break;
				case "rawValue":
					isValid = true;
					value = RawValue;
					break;
				case "displayValue":
					string displayValue;
					isValid = TryGetDisplayValue(Property, Format, RawValue, out displayValue);
					value = displayValue;
					break;
				case "conditions":
					isValid = true;
					value = Conditions;
					break;
				case "firstError":
					isValid = true;
					value = FirstError;
					break;
				case "firstError.message":
					isValid = true;
					value = FirstError == null ? "" : FirstError.Message;
					break;
				case "systemValue":
					string systemValue;
					if (!(isValid = TryGetSystemValue(Property, RawValue, out systemValue)))
						throw new ApplicationException("Cannot obtain a system value since the given object is invalid for the property");
					value = systemValue;
					break;
			}

			return new BindingResult() { IsValid = isValid, Value = value };
		}
		#endregion
	}
}
