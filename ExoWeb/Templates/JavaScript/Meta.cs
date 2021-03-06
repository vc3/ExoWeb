﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using Jurassic.Library;
using ExoModel;
using ExoRule;

namespace ExoWeb.Templates.JavaScript
{
	class Meta : ObjectInstance
	{
		ModelInstance instance;
		TypeWrapper typeWrapper;

		internal Meta(ScriptEngine engine, ModelInstance instance)
			: base(engine, engine.Object.InstancePrototype)
		{
			this.PopulateFunctions();
			this.instance = instance;
			this.typeWrapper = new TypeWrapper(engine, instance.Type);
		}

		[JSProperty(Name = "type")]
		public TypeWrapper TypeWrapper
		{
			get
			{
				return typeWrapper;
			}
		}

		[JSFunction(Name = "isAllowed")]
		public bool IsAllowed(string condition)
		{
			return !Condition.GetConditions(instance).Any(c => c.Type.Code == condition);
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (jsPropertyName == "id")
				return instance.Id;

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}

