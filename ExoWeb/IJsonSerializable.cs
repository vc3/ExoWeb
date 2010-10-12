﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Reflection;

namespace ExoWeb
{
	public interface IJsonSerializable
	{
		void Serialize(Json json);

		object Deserialize(Json json); 
	}
}
